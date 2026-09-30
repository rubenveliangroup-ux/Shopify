export const imageFragment = /* GraphQL */ `
  fragment image on Image { url altText width height }
`;

export const productFragment = /* GraphQL */ `
  fragment product on Product {
    id handle title description descriptionHtml productType tags availableForSale updatedAt
    options { id name optionValues { name } }
    priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
    compareAtPriceRange { maxVariantPrice { amount currencyCode } }
    featuredImage { ...image }
    images(first: 12) { edges { node { ...image } } }
    variants(first: 100) {
      edges {
        node {
          id title availableForSale
          selectedOptions { name value }
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
        }
      }
    }
    seo { title description }
  }
  ${imageFragment}
`;

export const cartFragment = /* GraphQL */ `
  fragment cart on Cart {
    id checkoutUrl totalQuantity
    cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
    lines(first: 100) {
      edges {
        node {
          id quantity
          attributes { key value }
          cost { totalAmount { amount currencyCode } }
          merchandise {
            ... on ProductVariant {
              id title
              selectedOptions { name value }
              product { handle title featuredImage { ...image } }
            }
          }
        }
      }
    }
  }
  ${imageFragment}
`;
