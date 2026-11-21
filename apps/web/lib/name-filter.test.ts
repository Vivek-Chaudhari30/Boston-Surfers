import { describe, expect, it } from 'vitest';
import { isNameAllowed } from './name-filter';

describe('isNameAllowed', () => {
  it('allows normal names', () => {
    for (const n of ['Spidey', 'TestAlice', 'Classy', 'Assist', 'Dickens', 'SuperRider', 'Pusheen', 'Campus']) expect(isNameAllowed(n)).toBe(true);
  });
  it('allows real names that contain a blocked substring', () => {
    for (const n of [
      'Harshit', 'Harshita', 'Kshitij', 'Nishita', 'Rishit', 'Shital', 'Ashita', 'Ash Itkin', 'Bit Chandler',
      'Nigeria', 'Nigel', 'Scunthorpe', 'Pussycat', 'Dickens',
    ])
      expect(isNameAllowed(n)).toBe(true);
  });
  it('blocks profanity, case and leetspeak insensitive', () => {
    for (const n of ['FUCK', 'f u c k', 'sh1t', 'b!tch', 'fuuuck', 'xx_shit_xx', 'a$$', 'Cunt', 'bullshit', 'dick', 'Niger', 'shitty', 'pussy']) expect(isNameAllowed(n)).toBe(false);
  });
});
