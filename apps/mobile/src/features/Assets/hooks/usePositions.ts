import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { skipToken } from '@reduxjs/toolkit/query'

import { POSITIONS_POLLING_INTERVAL } from '@/src/config/constants'
import { selectActiveSafe } from '@/src/store/activeSafeSlice'
import { useAppSelector } from '@/src/store/hooks'
import { selectCurrency } from '@/src/store/settingsSlice'
import { useHasFeature } from '@/src/hooks/useHasFeature'
import { FEATURES } from '@safe-global/utils/utils/chains'
import { usePositionsGetPositionsV1Query, type Protocol } from '@safe-global/store/gateway/AUTO_GENERATED/positions'
import { transformAppBalancesToProtocols, getPositionsEndpointConfig } from '@safe-global/utils/features/positions'
import useMobileTotalBalances from '@/src/hooks/useTotalBalances'

interface UsePositionsResult {
  data: Protocol[] | undefined
  error: unknown
  isLoading: boolean
  isFetching: boolean
  refetch: () => void
}

export const usePositions = (): UsePositionsResult => {
  const activeSafe = useSelector(selectActiveSafe)
  const currency = useAppSelector(selectCurrency)

  const isPositionsEnabled = useHasFeature(FEATURES.POSITIONS)
  const isPortfolioEndpointEnabled = useHasFeature(FEATURES.PORTFOLIO_ENDPOINT)

  const { shouldUsePortfolioEndpoint, shouldUsePositionsEndpoint } = getPositionsEndpointConfig(
    isPositionsEnabled,
    isPortfolioEndpointEnabled,
  )

  // Positions endpoint (fallback when portfolio endpoint is not available)
  const {
    data: positionsData,
    error: positionsError,
    isLoading: positionsLoading,
    isFetching: positionsFetching,
    refetch: positionsRefetch,
  } = usePositionsGetPositionsV1Query(
    !activeSafe || !shouldUsePositionsEndpoint
      ? skipToken
      : {
          chainId: activeSafe.chainId,
          safeAddress: activeSafe.address,
          fiatCode: currency,
        },
    {
      pollingInterval: POSITIONS_POLLING_INTERVAL,
    },
  )

  // Read positions from the total balances hook (portfolio data) when available.
  // This shares the same RTK Query cache as the balance display, avoiding duplicate requests.
  const {
    data: balancesData,
    error: balancesError,
    loading: balancesLoading,
    isFetching: balancesFetching,
    refetch: balancesRefetch,
  } = useMobileTotalBalances()

  return useMemo(
    () => ({
      data: shouldUsePortfolioEndpoint ? transformAppBalancesToProtocols(balancesData?.positions) : positionsData,
      error: shouldUsePortfolioEndpoint ? balancesError : positionsError,
      isLoading: shouldUsePortfolioEndpoint ? balancesLoading : positionsLoading,
      isFetching: shouldUsePortfolioEndpoint ? balancesFetching : positionsFetching,
      refetch: shouldUsePortfolioEndpoint ? balancesRefetch : positionsRefetch,
    }),
    [
      shouldUsePortfolioEndpoint,
      balancesData?.positions,
      balancesError,
      balancesLoading,
      balancesFetching,
      balancesRefetch,
      positionsData,
      positionsError,
      positionsLoading,
      positionsFetching,
      positionsRefetch,
    ],
  )
}
