import { Modal, View, Pressable, FlatList } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { Text, Icon } from '@/components/ui';
import type { DeviceBranch } from '@/services/device-service';

interface BranchSelectorModalProps {
  visible: boolean;
  branches: DeviceBranch[];
  activeBranchId: string | null;
  onSelect: (branch: DeviceBranch) => void;
  onClose: () => void;
}

export function BranchSelectorModal({
  visible,
  branches,
  activeBranchId,
  onSelect,
  onClose,
}: BranchSelectorModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: 320,
            backgroundColor: theme.colors.card,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: theme.spacing.lg,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <Text variant="label">Seleccionar sucursal</Text>
            <Pressable onPress={onClose}>
              <Icon name="close" size={20} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Branch list */}
          {branches.length === 0 ? (
            <View style={{ padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.md }}>
              <Icon name="location" size={32} color={theme.colors.textMuted} />
              <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
                No tienes sucursales asignadas.{'\n'}Contacta al administrador.
              </Text>
            </View>
          ) : (
            <FlatList
              data={branches}
              keyExtractor={(b) => b.id}
              renderItem={({ item }) => {
                const isActive = item.id === activeBranchId;
                return (
                  <Pressable
                    onPress={() => { onSelect(item); onClose(); }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.md,
                      paddingHorizontal: theme.spacing.lg,
                      paddingVertical: theme.spacing.md,
                      backgroundColor: isActive ? theme.colors.primarySoft : 'transparent',
                    }}
                  >
                    <Icon
                      name="location"
                      size={18}
                      color={isActive ? theme.colors.primary : theme.colors.textMuted}
                    />
                    <Text
                      variant="body"
                      style={{ flex: 1 }}
                      color={isActive ? theme.colors.primary : theme.colors.text}
                    >
                      {item.name}
                    </Text>
                    {isActive && (
                      <Icon name="check" size={16} color={theme.colors.primary} />
                    )}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: theme.colors.border, marginHorizontal: theme.spacing.lg }} />
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
