window.ELEVATOR_EXAM_CONFIG = {
  // Paste a public Google Sheet URL here. The app will convert standard sheet links
  // into a CSV export automatically. Leave blank to use the built-in local sample bank.
  questionSheetUrl: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?usp=sharing",
  questionSources: [
    {
      label: "Sheet1",
      sourceGroup: "Sheet1",
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?gid=0",
    },
    {
      label: "Escalators",
      sourceGroup: "Escalators",
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?gid=1133142445",
    },
    {
      label: "Inspections",
      sourceGroup: "Inspections",
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?gid=1615442244",
    },
    {
      label: "Existing",
      sourceGroup: "Existing",
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?gid=451646576",
    },
    {
      label: "Ele/Esc Electrical",
      sourceGroup: "Ele/Esc Electrical",
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?gid=393486330",
    },
  ],
  localQuestionBankUrl: "./question-bank-1000.csv",
  fullQuestionCount: 50,
  fullDurationMinutes: 180,
  sampleQuestionCount: 5,
  sampleDurationMinutes: 18,
  sourceMix: [
    { sourceGroup: "Sheet1", count: 15 },
    { sourceGroup: "Escalators", count: 14 },
    { sourceGroup: "Inspections", count: 7 },
    { sourceGroup: "Existing", count: 7 },
    { sourceGroup: "Ele/Esc Electrical", count: 7 },
  ],
};
