export type Money = { amount: string; currencyCode: string };

export type Image = { url: string; altText: string | null; width: number; height: number };

export type ProductOption = { id: string; name: string; values: string[] };

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
  price: Money;
  compareAtPrice: Money | null;
};

export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  options: ProductOption[];
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  compareAtPriceRange: { maxVariantPrice: Money };
  featuredImage: Image | null;
  images: Image[];
  variants: ProductVariant[];
  seo: { title: string | null; description: string | null };
  updatedAt: string;
};

export type Collection = {
  handle: string;
  title: string;
  description: string;
  image: Image | null;
};

export type CartLine = {
  id: string;
  quantity: number;
  attributes: { key: string; value: string }[];
  cost: { totalAmount: Money };
  merchandise: {
    id: string;
    title: string;
    selectedOptions: { name: string; value: string }[];
    product: { handle: string; title: string; featuredImage: Image | null };
  };
};

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: Money; totalAmount: Money };
  lines: CartLine[];
};

export type Connection<T> = { edges: { node: T }[] };
