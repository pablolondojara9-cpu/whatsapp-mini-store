
import type { ParsedOrder } from "./parse-order";

export type BusinessRuleResult = {
  valid: boolean;
  message: string | null;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

type ProductFamily = {
  keywords: string[];
  essentialIngredients: {
    names: string[];
    displayName: string;
  }[];
};

const PRODUCT_FAMILIES: Record<string, ProductFamily> = {
  hamburger: {
    keywords: ["hamburguesa", "hamburguesas", "burger"],
    essentialIngredients: [
      { names: ["pan"], displayName: "el pan" },
      { names: ["carne"], displayName: "la carne" },
      { names: ["queso"], displayName: "el queso" },
    ],
  },

  hotdog: {
    keywords: ["perro caliente", "perros calientes", "perro", "perros"],
    essentialIngredients: [
      { names: ["pan"], displayName: "el pan" },
      { names: ["salchicha"], displayName: "la salchicha" },
    ],
  },

  pizza: {
    keywords: ["pizza", "pizzas"],
    essentialIngredients: [
      { names: ["masa"], displayName: "la masa" },
      { names: ["queso"], displayName: "el queso" },
      {
        names: ["jamon", "tocineta", "pepperoni", "pollo"],
        displayName: "la proteína de la pizza",
      },
    ],
  },
};

const REMOVAL_WORDS = [
  "sin",
  "quitar",
  "quitale",
  "quitarle",
  "sacar",
  "sacarle",
  "eliminar",
  "eliminarle",
  "retirar",
  "retirarle",
  "reemplazar",
  "sustituir",
  "cambiar",
  "en vez de",
  "en lugar de",
];

function mentionsAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(normalize(word)));
}

function isRemovalRequest(text: string): boolean {
  return mentionsAny(text, REMOVAL_WORDS);
}

export function validateBusinessRules(
  parsedOrder: ParsedOrder,
  originalText: string
): BusinessRuleResult {
  const text = normalize(originalText);

  const orderSlugs = parsedOrder.items
    .map((item) => normalize(item.slug))
    .join(" ");

  // Usamos el mensaje y los productos reconocidos.
  // Así conservamos el contexto si el cliente responde
  // con una frase corta durante una aclaración.
  const context = `${text} ${orderSlugs}`;

  const hasNothingRequest = mentionsAny(text, [
    "sin nada",
    "sin todo",
    "sin ingredientes",
    "sin absolutamente nada",
    "quitar todo",
    "quitale todo",
    "sin ningun ingrediente",
  ]);

  const detectedFamilies = Object.entries(PRODUCT_FAMILIES).filter(
    ([, family]) => mentionsAny(context, family.keywords)
  );

  /*
   * REGLA 1: No vender productos sin sus ingredientes esenciales.
   */
  if (hasNothingRequest && detectedFamilies.length > 0) {
    return {
      valid: false,
      message:
        "🤔 No podemos preparar este producto sin sus ingredientes básicos.\n\nSi quieres, puedes pedir una modificación permitida, como quitar cebolla o tomate.",
    };
  }

  /*
   * REGLA 2: Rechazar la eliminación o sustitución
   * de ingredientes esenciales según la familia.
   */
  if (isRemovalRequest(text)) {
    for (const [, family] of detectedFamilies) {
      for (const ingredient of family.essentialIngredients) {
        if (mentionsAny(text, ingredient.names)) {
          return {
            valid: false,
            message:
              `🤔 No podemos preparar este producto sin ${ingredient.displayName.replace(/^el |^la /, "") === "pan" ? "pan" : ingredient.displayName.replace(/^el |^la /, "")}, ni sustituirlo por otro ingrediente.\n\nPuedes solicitar una modificación permitida, como quitar cebolla o tomate.`,
          };
        }
      }
    }
  }

  /*
   * REGLA 3: Si preguntan por quitar el pan de cualquier
   * producto, no pedir una aclaración que dé a entender
   * que sí se puede hacer.
   */
  const asksAboutAnyProduct = mentionsAny(text, [
    "algun producto",
    "cualquier producto",
    "a algun producto",
    "a cualquier producto",
  ]);

  if (
    asksAboutAnyProduct &&
    mentionsAny(text, ["pan", "arepa", "arepas"]) &&
    isRemovalRequest(text)
  ) {
    return {
      valid: false,
      message:
        "🤔 No podemos quitar el pan ni sustituirlo por arepas en los productos del catálogo.\n\nSi deseas una modificación válida, dime cuál ingrediente quieres retirar.",
    };
  }

  /*
   * REGLA 4: Las gaseosas no se pueden pedir sin gas.
   */
  const isSoftDrink = mentionsAny(context, [
    "gaseosa",
    "coca cola",
    "coca-cola",
    "cocacola",
    "sprite",
  ]);

  if (isSoftDrink && mentionsAny(text, ["sin gas", "quitar el gas"])) {
    return {
      valid: false,
      message:
        "🤔 Las gaseosas vienen preparadas y selladas de fábrica, por lo que no podemos ofrecerlas sin gas.\n\nPuedes elegir una de las bebidas disponibles en el catálogo.",
    };
  }

  /*
   * REGLA 5: No ofrecer una bebida sin su envase
   * cuando el producto del catálogo se vende en botella o lata.
   */
  if (
    isSoftDrink &&
    mentionsAny(text, [
      "sin envase",
      "sin botella",
      "sin lata",
      "quitar el envase",
      "quitar la botella",
    ])
  ) {
    return {
      valid: false,
      message:
        "🤔 No podemos entregar esta bebida sin su envase comercial.\n\nPuedes elegir otra bebida disponible en el catálogo.",
    };
  }

  return {
    valid: true,
    message: null,
  };
}
