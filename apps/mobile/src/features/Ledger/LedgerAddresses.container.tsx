import { Alert, FlatList } from 'react-native'
import { useEffect, useState, useRef } from 'react'
import { View, Text, getTokenValue } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { SectionTitle } from '@/src/components/Title'
import { SafeButton } from '@/src/components/SafeButton'
import { useScrollableHeader } from '@/src/navigation/useScrollableHeader'
import { NavBarTitle } from '@/src/components/Title'
import { Loader } from '@/src/components/Loader'
import { SafeFontIcon as Icon } from '@/src/components/SafeFontIcon/SafeFontIcon'
import { AddressItem } from '@/src/features/Ledger/components/AddressItem'
import { LoadMoreButton } from '@/src/features/Ledger/components/LoadMoreButton'
import { AddressesEmptyState } from '@/src/features/Ledger/components/AddressesEmptyState'
import { LedgerProgress } from '@/src/features/Ledger/components/LedgerProgress'
import { useLedgerAddresses, type DerivationPathType } from '@/src/features/Ledger/hooks/useLedgerAddresses'
import { useImportLedgerAddress } from '@/src/features/Ledger/hooks/useImportLedgerAddress'
import { FloatingMenu } from '@/src/features/Settings/components/FloatingMenu'

const TITLE = 'Select address to import'

const DERIVATION_PATH_OPTIONS = [
  { id: 'ledger-live' as const, title: 'Ledger Live' },
  { id: 'legacy-ledger' as const, title: 'Legacy Ledger' },
]

export const LedgerAddressesContainer = () => {
  const params = useLocalSearchParams<{ deviceName: string; sessionId: string }>()
  const { bottom } = useSafeAreaInsets()

  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [derivationPathType, setDerivationPathType] = useState<DerivationPathType>('ledger-live')
  const deviceLabel = params.deviceName || 'Ledger device'
  const {
    addresses,
    isLoading,
    error: fetchError,
    clearError: clearFetchError,
    fetchAddresses,
    clearAddresses,
  } = useLedgerAddresses({
    sessionId: params.sessionId,
    derivationPathType,
  })

  const { isImporting, error: importError, clearError: clearImportError, importAddress } = useImportLedgerAddress()

  const error = fetchError || importError
  const clearError = () => {
    clearFetchError()
    clearImportError()
  }

  // Fetch addresses only on initial mount
  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      void fetchAddresses(1)
    }
  }, [])

  useEffect(() => {
    if (!error) {
      return
    }

    const reset = () => clearError()

    switch (error.code) {
      case 'SESSION':
      case 'LOAD':
        if (addresses.length === 0) {
          Alert.alert(
            'Failed to Load Addresses',
            `Could not retrieve addresses from your ${deviceLabel}. Make sure it's connected and the Ethereum app is open.`,
            [
              {
                text: 'Retry',
                onPress: () => {
                  reset()
                  void fetchAddresses(1)
                },
              },
              {
                text: 'Go Back',
                onPress: () => {
                  reset()
                  router.back()
                },
              },
            ],
          )
        } else {
          Alert.alert('Error', error.message, [{ text: 'OK', onPress: reset }])
        }
        break
      case 'VALIDATION':
      case 'IMPORT':
        Alert.alert('Import Failed', error.message, [{ text: 'OK', onPress: reset }])
        break
      case 'OWNER_VALIDATION':
        clearError()
        router.push({
          pathname: '/import-signers/ledger-error',
          params: {
            address: addresses[selectedIndex]?.address || '',
          },
        })
        break
    }
  }, [error, clearError, fetchAddresses, deviceLabel, addresses, router, selectedIndex])

  const { handleScroll } = useScrollableHeader({
    children: <NavBarTitle paddingRight={5}>{TITLE}</NavBarTitle>,
  })

  const isInitialLoading = isLoading && addresses.length === 0

  if (isInitialLoading) {
    return (
      <View flex={1} justifyContent="center" alignItems="center" marginBottom={'$10'}>
        <LedgerProgress title="Loading addresses..." description={`Retrieving addresses from your ${deviceLabel}`} />
      </View>
    )
  }

  const handleImport = async () => {
    if (!addresses[selectedIndex]) {
      return
    }

    const selected = addresses[selectedIndex]
    const res = await importAddress(selected.address, selected.path, selected.index, deviceLabel)

    if (res && 'success' in res && res.success && 'selected' in res && res.selected) {
      router.push({
        pathname: '/import-signers/ledger-success',
        params: {
          address: res.selected.address,
          name: deviceLabel,
          path: res.selected.path,
        },
      })
    }
  }

  const handleSelectAddress = (item: { address: string; path: string; index: number }) => {
    const index = addresses.findIndex((addr) => addr.address === item.address)
    if (index >= 0) {
      setSelectedIndex(index)
    }
  }

  const selectedAddress = addresses[selectedIndex] || null

  const renderListHeader = () => (
    <View>
      <SectionTitle
        title={TITLE}
        paddingHorizontal={'$0'}
        description={`Select one or more addresses derived from your ${deviceLabel}. Make sure they are signers of the selected Safe Account.`}
      />

      {/* Derivation Path Selector */}
      <View backgroundColor="$backgroundDark" borderRadius="$3" marginTop="$4" marginBottom="$4">
        <View
          backgroundColor={'$background'}
          borderRadius={'$3'}
          paddingHorizontal="$3"
          paddingVertical="$3"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text fontSize="$4" fontWeight="600" color="$color">
            Derivation path
          </Text>
          <FloatingMenu
            onPressAction={({ nativeEvent }) => {
              const selected = nativeEvent.event as DerivationPathType
              setDerivationPathType(selected)
              clearAddresses()
              setSelectedIndex(0)
              // Fetch with explicitly passed derivation path type
              void fetchAddresses(1, 0, selected)
            }}
            actions={DERIVATION_PATH_OPTIONS}
          >
            <View flexDirection="row" alignItems="center" gap={4}>
              <Text color="$colorSecondary" fontSize="$3">
                {DERIVATION_PATH_OPTIONS.find((o) => o.id === derivationPathType)?.title || 'Ledger Live'}
              </Text>
              <Icon name={'chevron-down'} color="$colorSecondary" />
            </View>
          </FloatingMenu>
        </View>
      </View>

      {addresses[0] && (
        <View>
          <Text fontSize="$4" fontWeight="600" color="$color" marginTop="$4" marginBottom="$2">
            Default address:
          </Text>
          <View>
            <AddressItem
              item={{ ...addresses[0], isSelected: selectedIndex === 0 }}
              onSelect={handleSelectAddress}
              isFirst
              isLast
            />
          </View>
        </View>
      )}

      {addresses.length > 1 && (
        <Text fontSize="$4" fontWeight="600" color="$color" marginTop="$5" marginBottom="$2">
          Other addresses:
        </Text>
      )}
    </View>
  )

  const renderListFooter = () => <LoadMoreButton onPress={() => fetchAddresses(10)} isLoading={isLoading} />

  const renderEmptyState = () => <AddressesEmptyState />

  return (
    <View style={{ flex: 1 }} paddingBottom={Math.max(bottom, getTokenValue('$4'))}>
      <View flex={1}>
        <FlatList
          onScroll={handleScroll}
          data={addresses.slice(1)}
          renderItem={({ item, index }) => (
            <AddressItem
              item={{ ...item, isSelected: selectedIndex === index + 1 }}
              onSelect={handleSelectAddress}
              isFirst={index === 0}
              isLast={index === addresses.slice(1).length - 1}
            />
          )}
          keyExtractor={(item) => item.address}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderListFooter}
          ListEmptyComponent={addresses.length === 0 ? renderEmptyState : null}
          contentContainerStyle={{ paddingHorizontal: getTokenValue('$4') }}
          showsVerticalScrollIndicator={false}
        />
      </View>

      <View paddingHorizontal="$4" paddingTop="$4">
        <SafeButton
          onPress={handleImport}
          disabled={!selectedAddress || isImporting}
          testID="import-address-button"
          icon={isImporting ? <Loader size={18} thickness={2} /> : null}
        >
          Import
        </SafeButton>
      </View>
    </View>
  )
}
