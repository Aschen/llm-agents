// golfed version of uuid-v4
// uuid node module relies on crypto, which is a bit fat to embed
//
// cf amazing https://gist.github.com/jed/982883
//
// tribute to kuzzleio/sdk-javascript

export function uuidv4(a?: any) {
  return a
    ? (a ^ ((Math.random() * 16) >> (a / 4))).toString(16)
    : // @ts-ignore
      ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, uuidv4);
}
