import { escape } from "./components";
import { quizSeconds } from "../../../shared/src/returnMission";

const answerShapes = ["▲", "◆", "●", "■"];

export function countdown(fallback = "") {
  return `<div class="quiz-clock"><span data-quiz-clock>${escape(fallback)}</span><progress max="${quizSeconds}" value="${quizSeconds}" aria-label="Seconds remaining" hidden></progress></div>`;
}

export function quizQuestion(
  question: string,
  answers: { text: string; index: number }[],
  submit: { fact: string } | { mission: string } | { site: string; step: number } | { flight: number } | { fault: string },
) {
  const action = "fact" in submit
    ? `data-do="answer" data-fact="${escape(submit.fact)}"`
    : "mission" in submit
      ? `data-do="fieldAnswer" data-mission="${escape(submit.mission)}"`
      : "site" in submit
        ? `data-do="salvageAnswer" data-site="${escape(submit.site)}" data-step="${submit.step}"`
        : "fault" in submit
          ? `data-do="answerFlightQuiz" data-fault="${escape(submit.fault)}"`
          : `data-do="flightTask" data-step="${submit.flight}"`;
  const timedLesson = "fact" in submit || "mission" in submit;

  return `<div class="quiz-question">
    <header class="quiz-prompt">
      <span>SCIENCE QUIZ</span>
      <h3 id="quiz-question">${escape(question)}</h3>
    </header>
    ${"fault" in submit ? "" : countdown(timedLesson ? "Answer quickly for bonus points" : "")}
    <div class="quiz-answers" role="group" aria-labelledby="quiz-question">
      ${answers.map(({ text, index }, position) => `
        <button class="quiz-answer" type="button" ${action} data-answer="${index}">
          <span class="quiz-shape" aria-hidden="true">${answerShapes[position]}</span>
          <span>${escape(text)}</span>
        </button>`).join("")}
    </div>
    <p class="quiz-feedback" role="status"></p>
  </div>`;
}
