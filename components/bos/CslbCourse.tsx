"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  answeredCountForTopic,
  dueQuestionIds,
  loadCslbStore,
  markLessonRead,
  recordAnswer,
  saveCslbStore,
  type CslbSrsStore,
} from "@/lib/cslb/srs-store";
import { CSLB_TOPICS, getCslbTopic, type CslbTopicId } from "@/lib/cslb/topics";
import { getCslbQuestion, questionsForTopic } from "@/lib/cslb/questions";
import { todayKey } from "@/lib/cslb/srs";
import { playCslbQuestionAudio, stopCslbQuestionAudio } from "@/lib/cslb/play-audio";

type View =
  | { mode: "hub" }
  | { mode: "lesson"; topicId: CslbTopicId }
  | { mode: "practice"; topicId: CslbTopicId; index: number }
  | { mode: "review"; ids: string[]; index: number };

export function CslbCourse({ backHref }: { backHref: string }) {
  const [store, setStore] = useState<CslbSrsStore>(() => loadCslbStore());
  const [view, setView] = useState<View>({ mode: "hub" });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(loadCslbStore());
    setHydrated(true);
  }, []);

  useEffect(() => {
    return () => stopCslbQuestionAudio();
  }, []);

  function commit(next: CslbSrsStore) {
    setStore(next);
    saveCslbStore(next);
  }

  const dueIds = useMemo(
    () => (hydrated ? dueQuestionIds(store) : []),
    [hydrated, store],
  );

  function speakQuestion(questionId: string | undefined) {
    const q = questionId ? getCslbQuestion(questionId) : undefined;
    if (q) playCslbQuestionAudio(q.id, q.textEn);
  }

  if (view.mode === "lesson") {
    return (
      <LessonView
        topicId={view.topicId}
        onBack={() => setView({ mode: "hub" })}
        onContinue={() => {
          commit(markLessonRead(store, view.topicId));
          const first = questionsForTopic(view.topicId)[0];
          speakQuestion(first?.id);
          setView({ mode: "practice", topicId: view.topicId, index: 0 });
        }}
      />
    );
  }

  if (view.mode === "practice") {
    const list = questionsForTopic(view.topicId);
    const question = list[view.index];
    if (!question) {
      return (
        <DoneView
          title="Тема пройдена"
          body="Ошибки придут завтра в Повтор. Верные — позже, через 3 или 7 дней."
          onHub={() => setView({ mode: "hub" })}
        />
      );
    }
    return (
      <QuizView
        questionId={question.id}
        position={`${view.index + 1} / ${list.length}`}
        onBack={() => setView({ mode: "hub" })}
        onAnswer={(correct) => commit(recordAnswer(store, question.id, correct))}
        onNext={() => {
          const next = list[view.index + 1];
          speakQuestion(next?.id);
          setView({
            mode: "practice",
            topicId: view.topicId,
            index: view.index + 1,
          });
        }}
      />
    );
  }

  if (view.mode === "review") {
    const questionId = view.ids[view.index];
    if (!questionId) {
      return (
        <DoneView
          title="На сегодня пусто"
          body="Повторять нечего. Открой урок или практику по теме."
          onHub={() => setView({ mode: "hub" })}
        />
      );
    }
    return (
      <QuizView
        questionId={questionId}
        position={`${view.index + 1} / ${view.ids.length}`}
        onBack={() => setView({ mode: "hub" })}
        onAnswer={(correct) => commit(recordAnswer(store, questionId, correct))}
        onNext={() => {
          const nextId = view.ids[view.index + 1];
          speakQuestion(nextId);
          setView({ mode: "review", ids: view.ids, index: view.index + 1 });
        }}
      />
    );
  }

  return (
    <div className="cslb-course">
      <header className="cslb-hero">
        <p className="cslb-kicker">CSLB · C-61 / D-28</p>
        <h2>Law &amp; Business</h2>
        <p>
          Сначала урок по-русски, потом вопрос как на экзамене — на английском. Голос читает
          вопрос. Отвечать в микрофон не нужно.
        </p>
        <Link href={backHref} className="cslb-back">
          ← Назад
        </Link>
      </header>

      <button
        type="button"
        className="cslb-review-btn"
        disabled={dueIds.length === 0}
        onClick={() => {
          speakQuestion(dueIds[0]);
          setView({ mode: "review", ids: dueIds, index: 0 });
        }}
      >
        <strong>Повтор</strong>
        <span>
          {dueIds.length === 0
            ? "Сегодня повторять нечего"
            : `${dueIds.length} ${dueIds.length === 1 ? "вопрос" : "вопроса"} на сегодня`}
        </span>
      </button>

      <ul className="cslb-topics">
        {CSLB_TOPICS.map((topic, i) => {
          const total = questionsForTopic(topic.id).length;
          const answered = hydrated ? answeredCountForTopic(store, topic.id) : 0;
          const lessonDone = Boolean(store.lessons[topic.id]);
          return (
            <li key={topic.id} className="cslb-topic">
              <div className="cslb-topic__text">
                <span className="cslb-topic__num">{i + 1}</span>
                <div>
                  <strong>{topic.titleRu}</strong>
                  <em>{topic.titleEn}</em>
                  <small>
                    {lessonDone ? "Урок прочитан" : "Сначала урок"} · {answered}/{total}
                  </small>
                </div>
              </div>
              <div className="cslb-topic__actions">
                <button
                  type="button"
                  onClick={() => setView({ mode: "lesson", topicId: topic.id })}
                >
                  Урок
                </button>
                <button
                  type="button"
                  disabled={!lessonDone}
                  onClick={() => {
                    speakQuestion(questionsForTopic(topic.id)[0]?.id);
                    setView({ mode: "practice", topicId: topic.id, index: 0 });
                  }}
                >
                  Практика
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LessonView({
  topicId,
  onBack,
  onContinue,
}: {
  topicId: CslbTopicId;
  onBack: () => void;
  onContinue: () => void;
}) {
  const topic = getCslbTopic(topicId);
  return (
    <div className="cslb-course">
      <button type="button" className="cslb-back" onClick={onBack}>
        ← Темы
      </button>
      <p className="cslb-kicker">{topic.titleEn}</p>
      <h2>{topic.titleRu}</h2>
      <p className="cslb-lesson">{topic.lessonRu}</p>
      <dl className="cslb-terms">
        {topic.terms.map((term) => (
          <div key={term.en}>
            <dt>{term.en}</dt>
            <dd>{term.ru}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="cslb-primary" onClick={onContinue}>
        Понял — к практике
      </button>
    </div>
  );
}

function QuizView({
  questionId,
  position,
  onBack,
  onAnswer,
  onNext,
}: {
  questionId: string;
  position: string;
  onBack: () => void;
  onAnswer: (correct: boolean) => void;
  onNext: () => void;
}) {
  const question = getCslbQuestion(questionId);
  const [picked, setPicked] = useState<number | null>(null);
  const [showRu, setShowRu] = useState(false);

  useEffect(() => {
    setPicked(null);
    setShowRu(false);
  }, [questionId]);

  if (!question) return null;

  const current = question;
  const solved = picked !== null;
  const correct = picked === current.correctIndex;

  function pick(index: number) {
    if (picked !== null) return;
    setPicked(index);
    onAnswer(index === current.correctIndex);
  }

  return (
    <div className="cslb-course cslb-course--quiz">
      <div className="cslb-quiz-top">
        <button type="button" className="cslb-back" onClick={onBack}>
          ← Темы
        </button>
        <span>{position}</span>
      </div>

      <div className="cslb-speak-row">
        <button
          type="button"
          className="cslb-speak"
          onClick={() => playCslbQuestionAudio(current.id, current.textEn)}
        >
          Слушать
        </button>
        <button
          type="button"
          className="cslb-translate"
          aria-pressed={showRu}
          onClick={() => setShowRu((v) => !v)}
        >
          {showRu ? "Скрыть перевод" : "Перевод"}
        </button>
      </div>

      <h2 className="cslb-q">{current.textEn}</h2>
      {showRu ? <p className="cslb-q-ru">{current.textRu}</p> : null}

      <div className="cslb-options">
        {current.options.map((option, index) => {
          let state = "";
          if (solved && index === current.correctIndex) state = "is-correct";
          else if (solved && index === picked && !correct) state = "is-wrong";
          return (
            <button
              key={option.en}
              type="button"
              className={`cslb-option ${state}`}
              disabled={solved}
              onClick={() => pick(index)}
            >
              <span>{option.en}</span>
              {showRu ? <small>{option.ru}</small> : null}
            </button>
          );
        })}
      </div>

      {solved ? (
        <div className={`cslb-explain ${correct ? "is-ok" : "is-bad"}`}>
          <strong>{correct ? "Верно" : "Неверно"}</strong>
          <p>{current.explainEn}</p>
          <p>{current.explainRu}</p>
        </div>
      ) : null}

      {solved ? (
        <button type="button" className="cslb-primary" onClick={onNext}>
          Дальше
        </button>
      ) : null}
    </div>
  );
}

function DoneView({
  title,
  body,
  onHub,
}: {
  title: string;
  body: string;
  onHub: () => void;
}) {
  return (
    <div className="cslb-course">
      <h2>{title}</h2>
      <p>{body}</p>
      <button type="button" className="cslb-primary" onClick={onHub}>
        К темам
      </button>
    </div>
  );
}

export function CslbDueHint() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(dueQuestionIds(loadCslbStore(), todayKey()).length);
  }, []);
  if (count <= 0) return null;
  return <span className="cslb-teaser__due">{count} на сегодня</span>;
}
