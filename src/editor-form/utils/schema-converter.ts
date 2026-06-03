import type { FormSchema } from "../components/ui/DynamicForm";

/**
 * Converts a section/widget settings schema to DynamicForm format
 *
 * This utility function transforms the schema format from the registry
 * (SectionSchema.settingsSchema) to the format expected by DynamicForm.
 *
 * @param schema - The settings schema from section or widget registry
 * @returns FormSchema compatible with DynamicForm component
 */
export function convertSchemaToFormSchema(
  schema: Record<string, any>
): FormSchema {
  const formSchema: FormSchema = {};

  Object.entries(schema).forEach(([key, config]) => {
    formSchema[key] = {
      type: config.type,
      label: config.label,
      options: config.options,
      min: config.min,
      max: config.max,
      step: config.step,
      placeholder: config.placeholder,
      fields: config.fields,
      default: config.default,
    };
  });

  return formSchema;
}
