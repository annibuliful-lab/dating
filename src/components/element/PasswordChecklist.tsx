import { Text, Group } from '@mantine/core';
import { ActiveCheckCircle, CheckCircle } from '../icons/CheckCircle';

type Props = {
  password: string;
  validations: {
    label: string;
    validator: (pw: string) => boolean;
  }[];
};

export function PasswordChecklist({ password, validations }: Props) {
  return (
    <>
      {validations.map(({ label, validator }) => {
        const passed = validator(password);
        return (
          <Group key={label} gap="xs">
            {passed ? <ActiveCheckCircle /> : <CheckCircle />}

            <Text size="sm" c={passed ? 'dimmed' : 'gray'}>
              {label}
            </Text>
          </Group>
        );
      })}
    </>
  );
}
