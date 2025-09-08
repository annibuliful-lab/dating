"use client";

import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";

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
  return (
    <Modal opened={opened} onClose={onClose} title="Edit Message" size="md">
      <Stack gap="md">
        <TextInput
          value={editText}
          onChange={(e) => setEditText(e.currentTarget.value)}
          placeholder="Edit your message..."
          size="md"
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!editText.trim()}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
