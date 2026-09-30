import { cartFragment, imageFragment, productFragment } from './fragments';

export const getProductsQuery = /* GraphQL */ `
  query getProducts($first: Int!, $sortKey: ProductSortKeys, $reverse: Boolean, $query: String) {
    products(first: $first, sortKey: $sortKey, reverse: $reverse, query: $query) {
      edges { node { ...product } }
    }
  }
  ${productFragment}
`;

export const getProductQuery = /* GraphQL */ `
  query getProduct($handle: String!) {
    product(handle: $handle) { ...product }
  }
  ${productFragment}
`;

export const getRecommendationsQuery = /* GraphQL */ `
  query getRecommendations($productId: ID!) {
    productRecommendations(productId: $productId) { ...product }
  }
  ${productFragment}
`;

export const getCollectionProductsQuery = /* GraphQL */ `
  query getCollectionProducts($handle: String!, $first: Int!) {
    collection(handle: $handle) {
      handle title description image { ...image }
      products(first: $first) { edges { node { ...product } } }
    }
  }
  ${productFragment}
  ${imageFragment}
`;

export const getCartQuery = /* GraphQL */ `
  query getCart($cartId: ID!) { cart(id: $cartId) { ...cart } }
  ${cartFragment}
`;

export const createCartMutation = /* GraphQL */ `
  mutation cartCreate($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) { cart { ...cart } userErrors { message } }
  }
  ${cartFragment}
`;

export const addToCartMutation = /* GraphQL */ `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...cart } userErrors { message } }
  }
  ${cartFragment}
`;

export const updateCartMutation = /* GraphQL */ `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...cart } userErrors { message } }
  }
  ${cartFragment}
`;

export const removeFromCartMutation = /* GraphQL */ `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...cart } userErrors { message } }
  }
  ${cartFragment}
`;
