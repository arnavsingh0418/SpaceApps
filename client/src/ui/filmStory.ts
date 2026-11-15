export type ArrivalShot = {
  key: string;
  view: string;
  duration: number;
  act: string;
  place: string;
  title: string;
  status: string;
  lines: [string, string];
  fact: string;
};
const beat = (key: string, view: string, duration: number, text: string): ArrivalShot => ({
  key, view, duration, act: '', place: '', title: '', status: '',
  lines: [text, text], fact: '',
});

// One automatic 27-second story. Text stays brief so the moving scene leads.
export const arrivalStory: ArrivalShot[] = [
  beat('launch', 'launch', 6, 'Four explorers. One mission to Mars.'),
  beat('cruise', 'cruise', 4, 'Months from home. A new world ahead.'),
  beat('entry', 'entry', 4, 'Then the landing goes wrong.'),
  beat('touchdown', 'touchdown', 4, 'The crew survives. Their lander does not.'),
  beat('egress', 'egress', 6, 'Outside, a whole planet is waiting.'),
  beat('resolve', 'resolve', 3, 'Find the parts. Rebuild the return ship. Get everyone home.'),
];
export const arrivalDuration = arrivalStory.reduce((sum, shot) => sum + shot.duration, 0);
