import OpenAI from "openai";

const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  throw new Error("DEEPSEEK_API_KEY no está definida");
}

export const deepseek = new OpenAI({
  apiKey,
  baseURL: "https://api.deepseek.com",
});