import assert from 'node:assert/strict';
import {parsePickupNumber} from '../parser.mjs';
const good = [
  ['Order number one twenty five', '125'], ['One twenty five', '125'], ['One two five', '125'],
  ['Order 125!', '125'], ['Number one hundred twenty five', '125'], ['one hundred and five', '105'],
  ['one oh five', '105'], ['one fifteen', '115'], ['two thirty four', '234'],
  ['twelve thirty four', '1234'], ['Number 007', '7'], ['Order number twenty five please', '25'],
  ['Now serving 135', '135'], ['Order #129', '129'], ['two hundred thirty', '230'],
  ['one thousand two hundred thirty four', '1234'], ['ticket 56 is ready', '56'],
  ['one zero three', '103'], ['eight', '8'], ['one 25', '125']
];
for (const [input, expected] of good) {
  assert.equal(parsePickupNumber(input)?.number, expected, `Failed: ${input}`);
}
const bad = [
  '', 'I ordered two hot dogs and one pop', 'I have one two five dollars',
  'a very good day', 'The customer has order number 125', 'one twenty maybe',
  'twenty five apples', '10000', 'one two three four five',
  'john has a hot dog', 'fifty dollars', 'please give me number 14'
];
for (const input of bad) assert.equal(parsePickupNumber(input), null, `Must reject: ${input}`);
assert.equal(parsePickupNumber('One twenty five', {requireCue:true}), null);
assert.equal(parsePickupNumber('Number one twenty five', {requireCue:true})?.number, '125');
assert.equal(parsePickupNumber('Number one twenty five', {maxNumber:100}), null);
console.log(`PASS: ${good.length} valid, ${bad.length} invalid, 3 settings checks`);
