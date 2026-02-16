import { useMemo, useCallback } from 'react'
import { usePortfolioGetPortfolioV1Query } from '@safe-global/store/gateway/AUTO_GENERATED/portfolios'
import { type Balances, useBalancesGetBalancesV1Query } from '@safe-global/store/gateway/AUTO_GENERATED/balances'
import type { AsyncResult } from '@safe-global/utils/hooks/useAsync'
import {
  type PortfolioBalances,
  transformPortfolioToBalances,
  createPortfolioBalances,
  calculateTokensFiatTotal,
} from './portfolioBalances'

export interface UseTotalBalancesParams {
  safeAddress: string
  chainId: string
  currency: string
  trusted?: boolean
  hasPortfolioFeature: boolean
  isAllTokensSelected: boolean
  isDeployed: boolean
  counterfactualResult?: AsyncResult<Balances>
  skip?: boolean
  portfolioPollingInterval?: number
  txServicePollingInterval?: number
  skipPollingIfUnfocused?: boolean
  refetchOnFocus?: boolean
}

export interface TotalBalancesResult {
  data: PortfolioBalances | undefined
  error: Error | undefined
  loading: boolean
  isFetching: boolean
  refetch: () => void
}

interface TxServiceState {
  balances: Balances | undefined
  error: unknown
  loading: boolean
}

interface CounterfactualState {
  data: Balances | undefined
  error: Error | undefined
  loading: boolean
}

interface SharedResultFields {
  isFetching: boolean
  refetch: () => void
}

const toError = (error: unknown): Error | undefined => {
  return error ? new Error(String(error)) : undefined
}

/**
 * Builds a result from tx-service data or counterfactual data.
 * Used when portfolio is not available, not enabled, or needs fallback.
 */
const buildTxServiceResult = (
  txService: TxServiceState,
  counterfactual: CounterfactualState,
  isCounterfactual: boolean,
  shared: SharedResultFields,
): TotalBalancesResult => {
  if (isCounterfactual && counterfactual.data) {
    return {
      data: createPortfolioBalances(counterfactual.data),
      error: counterfactual.error,
      loading: counterfactual.loading,
      ...shared,
    }
  }

  if (txService.balances) {
    return {
      data: createPortfolioBalances(txService.balances),
      error: toError(txService.error),
      loading: txService.loading,
      ...shared,
    }
  }

  return { data: undefined, error: toError(txService.error), loading: true, ...shared }
}

/**
 * Builds a result from portfolio data in "Default Tokens" mode.
 */
const buildPortfolioResult = (
  portfolioBalances: PortfolioBalances | undefined,
  portfolioError: unknown,
  portfolioLoading: boolean,
  shared: SharedResultFields,
): TotalBalancesResult => {
  const error = toError(portfolioError)
  const isInitialLoading = !portfolioBalances && !error

  return {
    data: portfolioBalances,
    error,
    loading: portfolioLoading || isInitialLoading,
    ...shared,
  }
}

/**
 * Builds a merged result combining portfolio positions with tx-service token list ("All Tokens" mode).
 */
const buildMergedResult = (
  portfolioBalances: PortfolioBalances | undefined,
  portfolioLoading: boolean,
  portfolioError: unknown,
  txService: TxServiceState,
  shared: SharedResultFields,
): TotalBalancesResult => {
  if (portfolioLoading || txService.loading) {
    return { data: undefined, error: undefined, loading: true, ...shared }
  }

  const mergedError = portfolioError || txService.error
  if (mergedError) {
    return { data: undefined, error: new Error(String(mergedError)), loading: false, ...shared }
  }

  if (!portfolioBalances || !txService.balances) {
    return { data: undefined, error: undefined, loading: true, ...shared }
  }

  const mergedBalances: PortfolioBalances = {
    items: txService.balances.items,
    fiatTotal: portfolioBalances.fiatTotal,
    tokensFiatTotal: calculateTokensFiatTotal(txService.balances.items),
    positionsFiatTotal: portfolioBalances.positionsFiatTotal,
    positions: portfolioBalances.positions,
    isAllTokensMode: true,
  }

  return { data: mergedBalances, error: undefined, loading: false, isFetching: false, refetch: shared.refetch }
}

const useTotalBalances = (params: UseTotalBalancesParams): TotalBalancesResult => {
  const isReady = params.safeAddress && params.trusted !== undefined

  // 1. Portfolio query (when feature enabled)
  const {
    currentData: portfolioData,
    isLoading: portfolioLoading,
    isFetching: portfolioFetching,
    error: portfolioError,
    refetch: portfolioRefetch,
  } = usePortfolioGetPortfolioV1Query(
    {
      address: params.safeAddress,
      chainIds: params.chainId,
      fiatCode: params.currency,
      trusted: params.trusted,
    },
    {
      skip: params.skip || !params.hasPortfolioFeature || !isReady || !params.chainId,
      pollingInterval: params.portfolioPollingInterval,
    },
  )

  // 2. Check if portfolio needs fallback
  const isPortfolioEmpty =
    portfolioData && portfolioData.tokenBalances.length === 0 && portfolioData.positionBalances.length === 0
  const needsPortfolioFallback =
    params.hasPortfolioFeature && !params.skip && !portfolioLoading && (portfolioError || isPortfolioEmpty)

  // 3. Tx service query (fallback, "All Tokens" mode, or no portfolio feature)
  const shouldUseTxService =
    !params.hasPortfolioFeature || params.isAllTokensSelected || (needsPortfolioFallback && !params.isAllTokensSelected)
  const {
    currentData: txServiceBalances,
    isLoading: txServiceLoading,
    isFetching: txServiceFetching,
    error: txServiceError,
    refetch: txServiceRefetch,
  } = useBalancesGetBalancesV1Query(
    {
      chainId: params.chainId,
      safeAddress: params.safeAddress,
      fiatCode: params.currency,
      trusted: params.trusted,
    },
    {
      skip: params.skip || !shouldUseTxService || !isReady || !params.isDeployed,
      pollingInterval: params.txServicePollingInterval,
      skipPollingIfUnfocused: params.skipPollingIfUnfocused,
      refetchOnFocus: params.refetchOnFocus,
    },
  )

  const memoizedPortfolioBalances = useMemo(() => transformPortfolioToBalances(portfolioData), [portfolioData])

  // 4. Counterfactual override (web-only, injected as param)
  const [cfData, cfError, cfLoading] = params.counterfactualResult ?? [undefined, undefined, false]
  const isCounterfactual = !params.isDeployed

  const refetch = useCallback(() => {
    if (params.hasPortfolioFeature) {
      portfolioRefetch()
    }
    if (shouldUseTxService) {
      txServiceRefetch()
    }
  }, [params.hasPortfolioFeature, shouldUseTxService, portfolioRefetch, txServiceRefetch])

  const isFetching = portfolioFetching || txServiceFetching

  // 5. Transform + merge based on mode
  return useMemo<TotalBalancesResult>(() => {
    if (params.skip) {
      return { data: undefined, error: undefined, loading: false, isFetching: false, refetch }
    }

    const shared: SharedResultFields = { isFetching, refetch }
    const txService: TxServiceState = { balances: txServiceBalances, error: txServiceError, loading: txServiceLoading }
    const counterfactual: CounterfactualState = { data: cfData, error: cfError, loading: cfLoading }

    // No portfolio feature or portfolio needs fallback → tx service only
    if (!params.hasPortfolioFeature || (needsPortfolioFallback && !params.isAllTokensSelected)) {
      return buildTxServiceResult(txService, counterfactual, isCounterfactual, shared)
    }

    // Portfolio + default tokens mode
    if (!params.isAllTokensSelected) {
      return buildPortfolioResult(memoizedPortfolioBalances, portfolioError, portfolioLoading, shared)
    }

    // Portfolio + "All Tokens" merged mode
    return buildMergedResult(memoizedPortfolioBalances, portfolioLoading, portfolioError, txService, shared)
  }, [
    params.skip,
    params.hasPortfolioFeature,
    params.isAllTokensSelected,
    needsPortfolioFallback,
    isCounterfactual,
    cfData,
    cfError,
    cfLoading,
    memoizedPortfolioBalances,
    portfolioError,
    portfolioLoading,
    txServiceBalances,
    txServiceError,
    txServiceLoading,
    isFetching,
    refetch,
  ])
}

export default useTotalBalances
