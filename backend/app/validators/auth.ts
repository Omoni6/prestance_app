import vine from '@vinejs/vine'

/**
 * Validateur pour l'inscription
 */
export const registerValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine
      .string()
      .minLength(8)
      .regex(/[a-z]/)
      .regex(/[A-Z]/)
      .regex(/[0-9]/)
      .regex(/[^a-zA-Z0-9]/),
    fullName: vine.string().minLength(2).maxLength(100).optional(),
  })
)

/**
 * Validateur pour la connexion
 */
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(1),
  })
)

/**
 * Validateur pour la réinitialisation de mot de passe
 */
export const resetPasswordValidator = vine.compile(
  vine.object({
    password: vine
      .string()
      .minLength(8)
      .regex(/[a-z]/)
      .regex(/[A-Z]/)
      .regex(/[0-9]/)
      .regex(/[^a-zA-Z0-9]/),
    token: vine.string().minLength(1),
  })
)

/**
 * Validateur pour la demande de réinitialisation
 */
export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
  })
)
