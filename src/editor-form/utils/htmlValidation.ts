import { Linter } from "eslint-linter-browserify";
import { HtmlValidate } from "html-validate/browser";

// Validator instances (initialized once)
let linter: Linter;
let htmlValidate: HtmlValidate;

try {
  linter = new Linter();
  htmlValidate = new HtmlValidate({
    extends: ["html-validate:recommended"],
    rules: {
      "close-order": "error",
      "element-required-attributes": "off",
      "no-missing-references": "off",
    },
  });
} catch (error) {
  console.log("Error initializing validators:", error);
  throw error;
}

export interface HtmlValidationError {
  line: number;
  column: number;
  message: string;
}

/**
 * Validates HTML content (structure + JavaScript in script tags)
 */
export async function validateHtmlContent(
  html: string,
): Promise<HtmlValidationError[]> {
  if (!html.trim()) {
    return [];
  }

  const errors: HtmlValidationError[] = [];

  // Validate HTML structure using html-validate
  try {
    const htmlReport = await htmlValidate.validateString(html);

    if (htmlReport?.results) {
      htmlReport.results.forEach((result: any) => {
        result.messages?.forEach((msg: any) => {
          if (msg.severity === 2) {
            errors.push({
              line: msg.line || 1,
              column: msg.column || 1,
              message: `[HTML] ${msg.message}`,
            });
          }
        });
      });
    }
  } catch {
    // Ignore validation errors
  }

  // Validate JavaScript in <script> tags using ESLint
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const originalJsCode = match[1];
    if (!originalJsCode || match[0].includes("src=")) continue;

    // Find where JS code starts in HTML (after opening <script> tag)
    const beforeScript = html.substring(0, match.index);
    const scriptTagFull = match[0];
    const openingTagEnd = scriptTagFull.indexOf(">") + 1;
    const textBeforeJsCode =
      beforeScript + scriptTagFull.substring(0, openingTagEnd);
    const jsCodeStartLine = textBeforeJsCode.split("\n").length;

    const jsCodeForValidation = originalJsCode.trim();
    const leadingWhitespace =
      originalJsCode.length - originalJsCode.trimStart().length;
    const leadingNewlines = (
      originalJsCode.substring(0, leadingWhitespace).match(/\n/g) || []
    ).length;

    try {
      const eslintMessages = linter.verify(jsCodeForValidation, {
        rules: {},
        languageOptions: {
          parserOptions: { ecmaVersion: 2020, sourceType: "script" },
        },
      });

      eslintMessages.forEach((msg: any) => {
        if (msg.severity === 2 || msg.fatal === true) {
          const htmlLineNumber =
            jsCodeStartLine + leadingNewlines + (msg.line - 1);
          errors.push({
            line: htmlLineNumber,
            column: msg.column || 1,
            message: `[JS] ${msg.message}`,
          });
        }
      });
    } catch (err: any) {
      if (err && typeof err === "object" && "line" in err) {
        const htmlLineNumber =
          jsCodeStartLine + leadingNewlines + (err.line - 1);
        errors.push({
          line: htmlLineNumber,
          column: err.column || 1,
          message: `[JS] ${err.message || "Syntax error"}`,
        });
      }
    }
  }

  return errors;
}
