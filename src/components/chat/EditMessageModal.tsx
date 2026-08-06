'use client';

import {
  Button,
  Group,
  Modal,
  Stack,
  TextInput,
} from '@mantine/core';
import { useLocale } from '@/i18n/LocaleProvider';

interface EditMessageModalProps {
  opened: boolean;
  onClose: () => void;
  editText: string;
  setEditText: (text: string) => void;
  onSave: () => void;
}

export function EditMessageModal({
  opened,
  onClose,
  editText,
  setEditText,
  onSave,
}: EditMessageModalProps) {
  const { t } = useLocale();
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('editMessage')}
      size="md"
    >
      <Stack gap="md">
        <TextInput
          value={editText}
          onChange={(e) => setEditText(e.currentTarget.value)}
          placeholder={t('editMessagePlaceholder')}
          size="md"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={onSave} disabled={!editText.trim()}>
            {t('save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
