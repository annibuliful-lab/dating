import { Text, Box } from '@mantine/core';
import { ActiveCheckCircle } from '../icons/CheckCircle';

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
          <Box
            key={label}
            style={{
              display: 'grid',
              gridTemplateColumns: '22px 1fr',
              alignItems: 'center',
              columnGap: 8,
              marginBottom: 6,
            }}
          >
            {passed ? (
              <ActiveCheckCircle />
            ) : (
              <span style={{ display: 'inline-block', width: 22 }} />
            )}

            <Text size="sm" c={!passed ? 'dimmed' : 'gray'}>
              {label}
            </Text>
          </Box>
        );
      })}
    </>
  );
}
