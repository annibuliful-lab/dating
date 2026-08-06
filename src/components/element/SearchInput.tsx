import { SearchIcon } from '@/components/icons/SearchIcon';
import {
  CloseButton,
  TextInput,
  TextInputProps,
  rem,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { memo, useCallback, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';

type SearchInputProps = Omit<
  TextInputProps,
  'leftSection' | 'value' | 'onChange'
> & {
  placeholder?: string;
  onSearch?: (value: string) => void;
  debounce?: number;
  defaultValue?: string;
};

export const SearchInput = memo(
  ({
    placeholder = 'Search...',
    style,
    onSearch,
    debounce = 300,
    defaultValue = '',
    ...textInputProps
  }: SearchInputProps) => {
    const { t } = useLocale();
    const [internalValue, setInternalValue] = useState(defaultValue);

    const debouncedSearch = useDebouncedCallback(
      (searchValue: string) => {
        onSearch?.(searchValue);
      },
      debounce
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        debouncedSearch(newValue);
      },
      [debouncedSearch]
    );

    const handleClear = useCallback(() => {
      setInternalValue('');
      onSearch?.('');
    }, [onSearch]);

    return (
      <TextInput
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        inputMode="text"
        placeholder={placeholder}
        leftSection={
          <SearchIcon size={18} color="rgba(255, 255, 255, 0.4)" />
        }
        rightSection={
          internalValue && (
            <CloseButton
              size="sm"
              onClick={handleClear}
              aria-label={t('clearSearch')}
              style={{ opacity: 0.6 }}
            />
          )
        }
        value={internalValue}
        onChange={handleChange}
        styles={() => ({
          root: {
            flex: 1,
          },
          input: {
            backgroundColor: '#131313',
            paddingLeft: rem(30),
            borderColor: '#333',
            color: 'white',
            fontSize: rem(14),
            height: rem(42),
            borderRadius: rem(8),
            transition: 'all 0.2s ease',
            '&:focus': {
              borderColor: '#FFD700',
              backgroundColor: '#1a1a1a',
            },
            '&::placeholder': {
              color: '#666',
            },
          },
        })}
        style={style}
        {...textInputProps}
      />
    );
  }
);
SearchInput.displayName = 'SearchInput';
