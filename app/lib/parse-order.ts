import { deepseek } from "./deepseek";

export type OrderItemParsed = {
  slug: string;
  quantity: number;
  notes: string | null;
};

export type ParsedOrder = {
  items: OrderItemParsed[];
  unrecognized: string[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
};

type ProductForAI = {
  slug: string;
  name: string;
  price: number;
};

export async function parseOrder(
  text: string,
  products: ProductForAI[]
): Promise<ParsedOrder> {
  const productList = products
    .map(
      (product) =>
        `- slug: ${product.slug} | nombre: ${product.name} | precio: ${product.price}`
    )
    .join("\n");

  const systemPrompt = `
Eres el asistente de pedidos de La Esquina.

Tu única tarea es interpretar el texto de un cliente y convertirlo
en un pedido estructurado.

NO eres responsable de calcular precios.
NO eres responsable de comprobar stock.
NO puedes inventar productos.
NO puedes inventar slugs.

Estos son los productos disponibles actualmente:

${productList}

REGLAS:

1. Usa exclusivamente los slug proporcionados en la lista de productos.

2. Si el cliente menciona un producto que no existe en la lista,
   inclúyelo en "unrecognized".

3. Si el cliente menciona un producto de forma ambigua y existen
   varias opciones posibles, debes poner "needsClarification": true
   y hacer una pregunta clara en "clarificationQuestion".

4. Detecta cantidades.
   Ejemplos:
   "dos hamburguesas" → quantity: 2
   "una coca" → quantity: 1
   "3 papas grandes" → quantity: 3

5. Si no se indica cantidad, utiliza quantity: 1.

6. Detecta modificaciones o notas del producto cuando existan.
   Ejemplos:
   "sin cebolla"
   "sin tomate"
   "bien cocida"

   Estas deben ir en "notes".

7. Si no hay ninguna nota, utiliza null.

8. No inventes productos para intentar completar el pedido.

9. No calcules el total.

10. Tu respuesta DEBE ser únicamente un JSON válido.

El JSON debe tener exactamente esta estructura:

{
  "items": [
    {
      "slug": "string",
      "quantity": 1,
      "notes": "string or null"
    }
  ],
  "unrecognized": [],
  "needsClarification": false,
  "clarificationQuestion": null
}
`;

  const response = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: text,
      },
    ],
    response_format: {
      type: "json_object",
    },
    temperature: 0,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("DeepSeek no devolvió contenido");
  }

  let parsed: ParsedOrder;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("DeepSeek devolvió un JSON inválido");
  }

  return parsed;
}