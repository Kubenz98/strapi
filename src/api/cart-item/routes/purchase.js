module.exports = {
  routes: [
    {
      method: "DELETE",
      path: "/purchase",
      handler: "cart-item.purchase",
      config: {
        policies: [],
      },
    },
  ],
};
