// Founder B for the demo: the cold-start applicant. Fictional, and kept in a
// store-free module so client components can import her safely. She is not
// seeded into Memory; she enters live through the apply flow.
export const DEMO_COLD_START_APPLICATION = {
  name: "Amara Diallo",
  company: "Wardly",
  pitch:
    "I spent eleven years as a ward staffing coordinator in two NHS trusts. Rotas are still built in spreadsheets, and every gap costs a fortune in last-minute agency cover. I built a rota assistant that predicts gaps two weeks out and suggests swaps before agencies are needed. It started as a spreadsheet with formulas, then a no-code app. Three wards at my old trust use it unofficially, and the rota manager at a neighbouring trust asked for it after seeing it at a conference. I taught myself to build it at nights over two years. I have no engineering degree, no investors, and I have never raised money. I want to rebuild it properly and get it approved for wider NHS use.",
  links: [] as string[],
};
