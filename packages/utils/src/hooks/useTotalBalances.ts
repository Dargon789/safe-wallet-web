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

const useTotalBalances = (params: UseTotalBalancesParams): TotalBalancesResult => {
  const normalizedCurrency = params.currency.toUpperCase()
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
      fiatCode: normalizedCurrency,
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
      fiatCode: normalizedCurrency,
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

    // Shared fallback: returns tx service or counterfactual balances
    const getTxServiceFallback = (): TotalBalancesResult => {
      if (isCounterfactual && cfData) {
        return { data: createPortfolioBalances(cfData), error: cfError, loading: cfLoading, isFetching, refetch }
      }

      if (txServiceBalances) {
        const error = txServiceError ? new Error(String(txServiceError)) : undefined
        return {
          data: createPortfolioBalances(txServiceBalances),
          error,
          loading: txServiceLoading,
          isFetching,
          refetch,
        }
      }

      const error = txServiceError ? new Error(String(txServiceError)) : undefined
      return { data: undefined, error, loading: true, isFetching, refetch }
    }

    // No portfolio feature → tx service only
    if (!params.hasPortfolioFeature) {
      return getTxServiceFallback()
    }

    // Portfolio feature enabled, but needs fallback
    if (needsPortfolioFallback && !params.isAllTokensSelected) {
      return getTxServiceFallback()
    }

    // Portfolio + default tokens mode
    if (!params.isAllTokensSelected) {
      const error = portfolioError ? new Error(String(portfolioError)) : undefined
      const isInitialLoading = !memoizedPortfolioBalances && !error
      return {
        data: memoizedPortfolioBalances,
        error,
        loading: portfolioLoading || isInitialLoading,
        isFetching,
        refetch,
      }
    }

    // Portfolio + "All Tokens" merged mode
    if (portfolioLoading || txServiceLoading) {
      return { data: undefined, error: undefined, loading: true, isFetching, refetch }
    }

    const mergedError = portfolioError || txServiceError
    if (mergedError) {
      return { data: undefined, error: new Error(String(mergedError)), loading: false, isFetching, refetch }
    }

    if (!memoizedPortfolioBalances || !txServiceBalances) {
      return { data: undefined, error: undefined, loading: true, isFetching, refetch }
    }

    const mergedBalances: PortfolioBalances = {
      items: txServiceBalances.items,
      fiatTotal: memoizedPortfolioBalances.fiatTotal,
      tokensFiatTotal: calculateTokensFiatTotal(txServiceBalances.items),
      positionsFiatTotal: memoizedPortfolioBalances.positionsFiatTotal,
      positions: memoizedPortfolioBalances.positions,
      isAllTokensMode: true,
    }

    return { data: mergedBalances, error: undefined, loading: false, isFetching: false, refetch }
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
