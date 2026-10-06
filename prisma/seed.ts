console.log("🔥 SEED INICIADO");

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL no está definida");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const products = [
  {
    slug: "hamburguesa-clasica",
    name: "Hamburguesa clásica",
    description: "Hamburguesa clásica de La Esquina.",
    price: 18000,
    stock: 20,
  },
  {
    slug: "hamburguesa-bbq",
    name: "Hamburguesa BBQ",
    description: "Hamburguesa BBQ de La Esquina.",
    price: 22000,
    stock: 20,
  },
  {
    slug: "hamburguesa-doble",
    name: "Hamburguesa doble",
    description: "Hamburguesa doble de La Esquina.",
    price: 26000,
    stock: 20,
  },
  {
    slug: "perro-clasico",
    name: "Perro clásico",
    description: "Perro caliente clásico de La Esquina.",
    price: 14000,
    stock: 20,
  },
  {
    slug: "perro-especial",
    name: "Perro especial",
    description: "Perro caliente especial de La Esquina.",
    price: 18000,
    stock: 20,
  },
  {
    slug: "pizza-personal-pepperoni",
    name: "Pizza personal de pepperoni",
    description: "Pizza personal de pepperoni.",
    price: 20000,
    stock: 20,
  },
  {
    slug: "pizza-personal-hawaiana",
    name: "Pizza personal hawaiana",
    description: "Pizza personal hawaiana.",
    price: 21000,
    stock: 20,
  },
  {
    slug: "coca-cola",
    name: "Coca-Cola",
    description: "Coca-Cola.",
    price: 5000,
    stock: 30,
  },
  {
    slug: "sprite",
    name: "Sprite",
    description: "Sprite.",
    price: 5000,
    stock: 30,
  },
  {
    slug: "agua",
    name: "Agua",
    description: "Agua.",
    price: 3500,
    stock: 30,
  },
  {
    slug: "papas-pequenas",
    name: "Papas pequeñas",
    description: "Porción de papas pequeñas.",
    price: 6000,
    stock: 30,
  },
  {
    slug: "papas-grandes",
    name: "Papas grandes",
    description: "Porción de papas grandes.",
    price: 9000,
    stock: 30,
  },
  {
    slug: "salsa-de-ajo",
    name: "Salsa de ajo",
    description: "Salsa de ajo.",
    price: 2000,
    stock: 30,
  },
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: {
        slug: product.slug,
      },
      update: {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        active: true,
      },
      create: {
        ...product,
        active: true,
      },
    });
  }

  console.log(`✅ ${products.length} productos cargados correctamente.`);
}

main()
  .catch((error) => {
    console.error("❌ Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });