/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use an object param (opts) when multiple params share the same type",
    },
    messages: {
      useOptsParam:
        "Multiple params share the type '{{type}}' — use an object param instead: (opts: { ... }) => {}",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function check(node) {
      // Only consider plain identifier params — skip destructuring and rest
      const identParams = node.params.filter((p) => p.type === "Identifier");

      const typeCounts = new Map();
      for (const param of identParams) {
        if (!param.typeAnnotation) continue;
        const typeText = sourceCode.getText(param.typeAnnotation.typeAnnotation);
        typeCounts.set(typeText, (typeCounts.get(typeText) ?? 0) + 1);
      }

      for (const [type, count] of typeCounts) {
        if (count >= 2) {
          context.report({
            node,
            messageId: "useOptsParam",
            data: { type },
          });
          return; // one report per function
        }
      }
    }

    return {
      FunctionDeclaration: check,
      ArrowFunctionExpression: check,
      FunctionExpression: check,
    };
  },
};
