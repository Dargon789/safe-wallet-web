import { getChainsByIds, selectChainById } from '@/src/store/chains'
import { Balance } from './Balance'
import { RootState } from '@/src/store'
import { selectSafeChains } from '@/src/store/safesSlice'
import { useAppSelector } from '@/src/store/hooks'
import React, { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useDefinedActiveSafe } from '@/src/store/hooks/activeSafe'
import { useCopyAndDispatchToast } from '@/src/hooks/useCopyAndDispatchToast'
import useMobileTotalBalances from '@/src/hooks/useTotalBalances'

export function BalanceContainer() {
  const activeSafe = useDefinedActiveSafe()
  const chainsIds = useAppSelector((state: RootState) => selectSafeChains(state, activeSafe.address))
  const activeSafeChains = useAppSelector((state: RootState) => getChainsByIds(state, chainsIds))
  const copy = useCopyAndDispatchToast()
  const { data, loading } = useMobileTotalBalances()
  const activeChain = useSelector((state: RootState) => selectChainById(state, activeSafe.chainId))

  const onPressAddressCopy = useCallback(() => {
    copy(activeSafe.address)
  }, [activeSafe.address])

  return (
    <Balance
      chainName={activeChain?.chainName}
      chains={activeSafeChains}
      isLoading={loading}
      activeChainId={activeSafe.chainId}
      safeAddress={activeSafe.address}
      balanceAmount={data?.fiatTotal || ''}
      onPressAddressCopy={onPressAddressCopy}
    />
  )
}
