import {regexToken, SPACE} from '../lib/tokenTypes';

const ALIGN_CONTENT = regexToken(
  /(flex-(?:start|end)|center|stretch|space-(?:between|around))/
);

const JUSTIFY_CONTENT = regexToken(
  /(flex-(?:start|end)|center|space-(?:between|around|evenly))/
);

export default tokenStream => {
  const alignContent = tokenStream.expect(ALIGN_CONTENT);
  let justifyContent;

  if (tokenStream.hasTokens()) {
    tokenStream.expect(SPACE);
    justifyContent = tokenStream.expect(JUSTIFY_CONTENT);
  } else {
    justifyContent = 'stretch';
  }

  tokenStream.expectEmpty();

  return {alignContent, justifyContent};
}
