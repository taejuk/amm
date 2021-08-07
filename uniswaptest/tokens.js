const { Token, Ether } = require("@uniswap/sdk-core");

exports.AMPL = new Token(
  1,
  "0xD46bA6D942050d489DBd938a2C909A5d5039A161",
  9,
  "AMPL",
  "Ampleforth"
);
exports.DAI = new Token(
  1,
  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  18,
  "DAI",
  "Dai Stablecoin"
);
exports.USDC = new Token(
  1,
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  6,
  "USDC",
  "USD//C"
);
exports.USDT = new Token(
  1,
  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  6,
  "USDT",
  "Tether USD"
);
exports.WBTC = new Token(
  1,
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  8,
  "WBTC",
  "Wrapped BTC"
);
exports.FEI = new Token(
  1,
  "0x956F47F50A910163D8BF957Cf5846D573E7f87CA",
  18,
  "FEI",
  "Fei USD"
);
exports.TRIBE = new Token(
  1,
  "0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B",
  18,
  "TRIBE",
  "Tribe"
);
exports.FRAX = new Token(
  1,
  "0x853d955aCEf822Db058eb8505911ED77F175b99e",
  18,
  "FRAX",
  "Frax"
);
exports.FXS = new Token(
  1,
  "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0",
  18,
  "FXS",
  "Frax Share"
);
exports.renBTC = new Token(
  1,
  "0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D",
  8,
  "renBTC",
  "renBTC"
);
exports.UMA = new Token(
  1,
  "0x04Fa0d235C4abf4BcF4787aF4CF447DE572eF828",
  18,
  "UMA",
  "UMA Voting Token v1"
);
exports.ETH2X_FLI = new Token(
  1,
  "0xAa6E8127831c9DE45ae56bB1b0d4D4Da6e5665BD",
  18,
  "ETH2x-FLI",
  "ETH 2x Flexible Leverage Index"
);

exports.ETH = Ether.onChain(1);
