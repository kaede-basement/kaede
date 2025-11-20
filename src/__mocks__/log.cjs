const fn = () => {};

module.exports = {
  "log": {
    "debug"    : fn,
    "info"     : fn,
    "warn"     : fn,
    "error"    : fn,
    "templates": {
      "hooks": {
        "iterate": {
          "start"      : fn,
          "execution"  : fn,
          "response"   : fn,
          "no-response": fn,
          "end"        : fn,
        },
      },
    },
  },
};
