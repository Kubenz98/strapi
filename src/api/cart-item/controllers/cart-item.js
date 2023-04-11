"use strict";

/**
 * cart-item controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::cart-item.cart-item",
  ({ strapi }) => ({
    async create(ctx) {
      //create cart item
      const user = ctx.state.user;
      const entityId = ctx.request.body.data.product;
      try {
        const entries = await strapi.services["api::cart-item.cart-item"].find({
          filters: { user: user.id },
          populate: ["product"],
        });
        let itemToUpdate;

        for (const entry of entries.results) {
          if (entry.product.id === entityId) {
            itemToUpdate = entry;
            itemToUpdate.quantity++;
          }
        }
        ctx.request.body.data.user = ctx.state.user.id;
        let entity;
        if (!itemToUpdate) {
          ctx.request.body.data.quantity = 1;
          entity = await strapi.services["api::cart-item.cart-item"].create(
            ctx.request.body
          );
        } else {
          entity = await strapi.entityService.update(
            "api::cart-item.cart-item",
            itemToUpdate.id,
            {
              data: {
                quantity: itemToUpdate.quantity,
              },
            }
          );
        }
        const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
        return this.transformResponse(sanitizedEntity);
      } catch (err) {
        console.error(err);
        ctx.response.status = 500;
        ctx.send({ error: "Internal server error" });
      }
    },
    async find(ctx) {
      try {
        //find user cart items
        const user = ctx.state.user;
        ctx.query.filters = {
          ...(ctx.query.filters || {}),
          user: user.id,
        };
        return await super.find(ctx);
      } catch (err) {
        console.error(err);
        ctx.response.status = 500;
        ctx.send({ error: "Internal server error" });
      }
    },
    async update(ctx) {
      //updating cart item quantity
      const { action, id } = ctx.request.body;
      try {
        const entries = await strapi.services["api::cart-item.cart-item"].find({
          filters: { id },
        });

        console.log("[ENTRIES]:", entries);
        let entity;
        let updatedQuantity;

        if (action === "addOne") {
          updatedQuantity = entries.results[0].quantity + 1;
        } else if (action === "subtractOne") {
          updatedQuantity = entries.results[0].quantity - 1;
        }
        if (updatedQuantity > 0) {
          entity = await strapi.entityService.update(
            "api::cart-item.cart-item",
            id,
            {
              data: {
                quantity: updatedQuantity,
              },
            }
          );
        } else {
          entity = await strapi.entityService.delete(
            "api::cart-item.cart-item",
            id
          );
        }
        const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
        return this.transformResponse(sanitizedEntity);
      } catch (err) {
        console.error(err);
        ctx.response.status = 500;
        ctx.send({ error: "Internal server error" });
      }
    },
    async purchase(ctx) {
      const user = ctx.state.user.id;
      try {
        const userCarItems = await strapi.db
          .query("api::cart-item.cart-item")
          .findMany({ where: { user }, populate: { product: true } })
          .then((r) => {
            const items = r.map((item) => {
              return {
                id: item.id,
                quantity: item.quantity,
                price: item.quantity * item.product.price,
                product: item.product.id,
              };
            });
            return items;
          })
          .catch((err) => console.error(err));

        const order = await strapi.entityService.create("api::order.order", {
          data: {
            user,
          },
        });
        const promises = userCarItems.map(async (item) => {
          return strapi.entityService.create("api::order-item.order-item", {
            data: {
              user,
              quantity: item.quantity,
              price: item.price,
              product: item.product,
            },
          });
        });
        const orderItems = await Promise.all(promises);
        let totalAmount = orderItems.reduce((sum, item) => sum + item.price, 0).toFixed(2);
        await strapi.entityService.update("api::order.order", order.id, {
          data: {
            totalAmount,
            orderItems,
          },
        });
        await strapi.db.query("api::cart-item.cart-item").deleteMany({
          where: { id: { $in: userCarItems.map(({ id }) => id) } },
        });
        return ctx.send([]);
      } catch (err) {
        console.error(err);
        ctx.response.status = 500;
        ctx.send({ error: "Internal server error" });
      }
    },
  })
);
