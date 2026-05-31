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
      label: "Platform and Wheelchair Lifts",
      sourceGroup: "Platform and Wheelchair Lifts",
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?gid=393486330",
    },
    {
      label: "Belt Manlift",
      sourceGroup: "Belt Manlift",
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/edit?gid=377685717",
    },
    {
      label: "Conveyers",
      sourceGroup: "Conveyers",
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/gviz/tq?tqx=out:csv&sheet=Conveyers",
    },
    {
      label: "Personnel and employee",
      sourceGroup: "Personnel and employee",
      url: "https://docs.google.com/spreadsheets/d/1XSD_CNSqc9tiPmReZV6k6F1mtNWdIqXu6hR29S5yN1s/gviz/tq?tqx=out:csv&sheet=Personnel%20and%20employee",
    },
  ],
  localQuestionBankUrl: "./question-bank-1000.csv",
  fullQuestionCount: 50,
  fullPassingCorrectCount: 35,
  fullDurationMinutes: 180,
  sampleQuestionCount: 5,
  sampleDurationMinutes: 18,
  sourceMix: [
    { label: "Elevators - Accessibility", sourceGroup: "Existing", sourceMatch: "Ch 11", count: 3 },
    { label: "Elevators - Hydraulic Elevators", sourceGroup: "Sheet1", topicMatch: "hydraulic", count: 8 },
    { label: "Elevators - Other Lifts", sourceGroup: "Platform and Wheelchair Lifts", count: 1 },
    { label: "Elevators - Other Lifts", sourceGroup: "Belt Manlift", count: 1 },
    { label: "Elevators - Other Lifts", sourceGroup: "Conveyers", count: 1 },
    { label: "Elevators - Administration and Code Requirements", sourceGroup: "Existing", sourceMatch: "2014 NYC BC Ch 30", count: 2 },
    { label: "Elevators - Electric Elevators", sourceGroup: "Sheet1", count: 20 },
    { label: "Escalators - Moving Walkways", sourceGroup: "Escalators", topicMatch: "moving walks", count: 1 },
    { label: "Escalators - Safety", sourceGroup: "Escalators", count: 6 },
    { label: "Escalators - Maintenance and Testing", sourceGroup: "Inspections", count: 5 },
    { label: "Escalators - Administration and Code Requirements", sourceGroup: "Existing", count: 2 },
  ],
};
