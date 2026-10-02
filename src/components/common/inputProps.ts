// Applied to each text control, including those outside a form. These disable
// browser form-history suggestions and request no keyboard correction/prediction.
export const textInputProps = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
} as const
