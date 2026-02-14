import { useMemo } from 'react'
import { useAppSelector } from '@/src/store/hooks'
import { selectAllChains } from '@/src/store/chains'
import { useSafesGetOverviewForManyQuery, useSafesGetOverviewForManyV2Query } from '@safe-global/store/gateway/safes'
import { FEATURES, hasFeature } from '@safe-global/utils/utils/chains'
import type { SafeOverview } from '@safe-global/store/gateway/AUTO_GENERATED/safes'

type OverviewQueryArgs = {
  safes: string[]
  currency: string
  trusted?: boolean
  excludeSpam?: boolean
  walletAddress?: string
}

type OverviewQueryOptions = {
  skip?: boolean
  pollingInterval?: number
}

/**
 * Wrapper around V1/V2 SafeOverview queries that automatically uses the V2 (portfolio) endpoint
 * for chains that have the PORTFOLIO_ENDPOINT feature enabled. This ensures fiatTotal includes
 * DeFi positions for supported chains, matching the web app behavior.
 */
export function useSafeOverviewsQuery(args: OverviewQueryArgs, options?: OverviewQueryOptions) {
  const chains = useAppSelector(selectAllChains)

  const { v1Safes, v2Safes } = useMemo(() => {
    const v1: string[] = []
    const v2: string[] = []

    for (const safeId of args.safes) {
      // safeId format: "chainId:0xaddress"
      const chainId = safeId.split(':')[0]
      const chain = chains.find((c) => c.chainId === chainId)

      if (chain && hasFeature(chain, FEATURES.PORTFOLIO_ENDPOINT)) {
        v2.push(safeId)
      } else {
        v1.push(safeId)
      }
    }

    return { v1Safes: v1, v2Safes: v2 }
  }, [args.safes, chains])

  const skip = options?.skip || args.safes.length === 0
  const normalizedArgs = { ...args, currency: args.currency.toUpperCase() }

  const v1Result = useSafesGetOverviewForManyQuery(
    { ...normalizedArgs, safes: v1Safes },
    { skip: skip || v1Safes.length === 0, pollingInterval: options?.pollingInterval },
  )

  const v2Result = useSafesGetOverviewForManyV2Query(
    { ...normalizedArgs, safes: v2Safes },
    { skip: skip || v2Safes.length === 0, pollingInterval: options?.pollingInterval },
  )

  const data = useMemo(() => {
    if (skip) {
      return undefined
    }

    const v1Data = v1Safes.length > 0 ? v1Result.data : []
    const v2Data = v2Safes.length > 0 ? v2Result.data : []

    if (!v1Data && !v2Data) {
      return undefined
    }

    return [...(v1Data || []), ...(v2Data || [])] as SafeOverview[]
  }, [skip, v1Safes, v2Safes, v1Result.data, v2Result.data])

  const isLoading = (v1Safes.length > 0 && v1Result.isLoading) || (v2Safes.length > 0 && v2Result.isLoading)
  const isFetching = (v1Safes.length > 0 && v1Result.isFetching) || (v2Safes.length > 0 && v2Result.isFetching)
  const error = v1Result.error || v2Result.error
  const currentData = useMemo(() => {
    if (skip) {
      return undefined
    }

    const v1Data = v1Safes.length > 0 ? v1Result.currentData : []
    const v2Data = v2Safes.length > 0 ? v2Result.currentData : []

    if (!v1Data && !v2Data) {
      return undefined
    }

    return [...(v1Data || []), ...(v2Data || [])] as SafeOverview[]
  }, [skip, v1Safes, v2Safes, v1Result.currentData, v2Result.currentData])

  return { data, currentData, isLoading, isFetching, error }
}
