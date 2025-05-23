import { ethers } from 'ethers'
import { useState } from 'react'
import Clipboard from '@react-native-clipboard/clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { storePrivateKey } from '@/src/hooks/useSign/useSign'

const ERROR_MESSAGE = 'Invalid private key.'
export const useImportPrivateKey = () => {
  const [privateKey, setPrivateKey] = useState('')
  const [wallet, setWallet] = useState<ethers.Wallet>()
  const local = useLocalSearchParams<{ safeAddress: string; chainId: string; import_safe: string }>()
  const [error, setError] = useState<string>()
  const router = useRouter()

  const handlePrivateKeyChange = (text: string) => {
    setPrivateKey(text)
    try {
      const wallet = new ethers.Wallet(text)
      setWallet(wallet)
      setError(undefined)
    } catch {
      setError(ERROR_MESSAGE)
    }
  }

  const handleImport = async () => {
    if (!wallet) {
      return setError(ERROR_MESSAGE)
    }

    try {
      await storePrivateKey(wallet.address, privateKey)
      router.push({
        pathname: '/import-signers/loading',
        params: {
          address: wallet.address,
          safeAddress: local.safeAddress,
          chainId: local.chainId,
          import_safe: local.import_safe,
        },
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onPrivateKeyPaste = async () => {
    const text = await Clipboard.getString()
    handlePrivateKeyChange(text.trim())
  }

  return { handlePrivateKeyChange, handleImport, onPrivateKeyPaste, privateKey, wallet, error }
}
