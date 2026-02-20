import { FormEvent, useEffect, useMemo, useState } from 'react';

type Exercise = {
  id: string;
  name: string;
  currentWeight: number;
  previousWeight: number | null;
  bestWeight: number;
  completed: boolean;
  notes: string;
  targetSets: number;
  completedSets: number;
};

type TrainingPlan = {
  id: string;
  name: string;
  exercises: Exercise[];
};

type HistoryExercise = {
  name: string;
  weight: number;
  completedSets: number;
  targetSets: number;
  isPr: boolean;
};

type TrainingHistoryEntry = {
  id: string;
  dateIso: string;
  planId: string;
  planName: string;
  exercises: HistoryExercise[];
};

const STORAGE_KEY = 'gymapp:v2:plans';
const HISTORY_KEY = 'gymapp:v2:history';

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampWeight(value: number) {
  return Math.max(0, Math.min(300, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeExercise(input: Partial<Exercise> & { id: string; name: string }): Exercise {
  const currentWeight = Number(input.currentWeight ?? 0);
  const targetSets = clampInt(Number(input.targetSets ?? 3), 1, 12);
  const completedSets = clampInt(Number(input.completedSets ?? 0), 0, targetSets);

  return {
    id: input.id,
    name: input.name,
    currentWeight,
    previousWeight: input.previousWeight ?? null,
    bestWeight: Number(input.bestWeight ?? currentWeight),
    completed: Boolean(input.completed ?? completedSets >= targetSets),
    notes: String(input.notes ?? ''),
    targetSets,
    completedSets
  };
}

function loadPlans(): TrainingPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as TrainingPlan[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((plan) => ({
      ...plan,
      exercises: Array.isArray(plan.exercises)
        ? plan.exercises.map((exercise) =>
            normalizeExercise(exercise as Partial<Exercise> & { id: string; name: string })
          )
        : []
    }));
  } catch {
    return [];
  }
}

function loadHistory(): TrainingHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as TrainingHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDelta(exercise: Exercise) {
  if (exercise.previousWeight === null) {
    return null;
  }

  const deltaKg = exercise.currentWeight - exercise.previousWeight;
  if (deltaKg <= 0) {
    return null;
  }

  const deltaPercent =
    exercise.previousWeight > 0
      ? (deltaKg / exercise.previousWeight) * 100
      : 100;

  return `+${deltaKg.toFixed(1)} kg / +${deltaPercent.toFixed(1)}%`;
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export default function App() {
  const [plans, setPlans] = useState<TrainingPlan[]>(() => loadPlans());
  const [history, setHistory] = useState<TrainingHistoryEntry[]>(() => loadHistory());
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'today' | 'exercises' | 'manage'>('today');

  const [planName, setPlanName] = useState('');
  const [planEditName, setPlanEditName] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseWeight, setExerciseWeight] = useState('20.0');

  const [restSeconds, setRestSeconds] = useState(90);
  const [restRunning, setRestRunning] = useState(false);

  const [draggingExerciseId, setDraggingExerciseId] = useState<string | null>(null);
  const [dragOverExerciseId, setDragOverExerciseId] = useState<string | null>(null);

  const weightOptions = useMemo(() => {
    const options: string[] = [];
    for (let value = 0; value <= 300; value += 0.5) {
      options.push(value.toFixed(1));
    }
    return options;
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (plans.length === 0) {
      setActivePlanId('');
      return;
    }

    const exists = plans.some((plan) => plan.id === activePlanId);
    if (!exists) {
      setActivePlanId(plans[0].id);
    }
  }, [plans, activePlanId]);

  useEffect(() => {
    if (!restRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setRestSeconds((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          setRestRunning(false);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [restRunning]);

  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === activePlanId) ?? null,
    [plans, activePlanId]
  );

  const planStats = useMemo(() => {
    if (!activePlan) {
      return { exerciseCount: 0, avgWeight: 0, progressCount: 0, completedCount: 0 };
    }

    const exerciseCount = activePlan.exercises.length;
    const totalWeight = activePlan.exercises.reduce(
      (sum, exercise) => sum + exercise.currentWeight,
      0
    );
    const avgWeight = exerciseCount > 0 ? totalWeight / exerciseCount : 0;
    const progressCount = activePlan.exercises.filter(
      (exercise) => exercise.previousWeight !== null && exercise.currentWeight > exercise.previousWeight
    ).length;
    const completedCount = activePlan.exercises.filter((exercise) => exercise.completed).length;

    return { exerciseCount, avgWeight, progressCount, completedCount };
  }, [activePlan]);

  useEffect(() => {
    setPlanEditName(activePlan?.name ?? '');
  }, [activePlan]);

  function createPlan(event: FormEvent) {
    event.preventDefault();

    const name = planName.trim();
    if (!name) {
      return;
    }

    const newPlan: TrainingPlan = {
      id: createId(),
      name,
      exercises: []
    };

    setPlans((previous) => [newPlan, ...previous]);
    setActivePlanId(newPlan.id);
    setPlanName('');
  }

  function addExercise(event: FormEvent) {
    event.preventDefault();
    if (!activePlan) {
      return;
    }

    const name = exerciseName.trim();
    const parsedWeight = Number.parseFloat(exerciseWeight);

    if (!name || Number.isNaN(parsedWeight) || parsedWeight < 0) {
      return;
    }

    const normalizedWeight = Number(parsedWeight.toFixed(1));

    const newExercise: Exercise = {
      id: createId(),
      name,
      currentWeight: normalizedWeight,
      previousWeight: null,
      bestWeight: normalizedWeight,
      completed: false,
      notes: '',
      targetSets: 3,
      completedSets: 0
    };

    setPlans((previous) =>
      previous.map((plan) =>
        plan.id === activePlan.id
          ? { ...plan, exercises: [...plan.exercises, newExercise] }
          : plan
      )
    );

    setExerciseName('');
    setExerciseWeight('20.0');
  }

  function updateExerciseWeight(exerciseId: string, value: string) {
    const parsedWeight = Number.parseFloat(value);
    if (Number.isNaN(parsedWeight) || parsedWeight < 0 || !activePlan) {
      return;
    }

    const nextWeight = Number(parsedWeight.toFixed(1));

    setPlans((previous) =>
      previous.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        return {
          ...plan,
          exercises: plan.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) {
              return exercise;
            }

            if (exercise.currentWeight === nextWeight) {
              return exercise;
            }

            return {
              ...exercise,
              previousWeight: exercise.currentWeight,
              currentWeight: nextWeight,
              bestWeight: Math.max(exercise.bestWeight, nextWeight),
              completed: false
            };
          })
        };
      })
    );
  }

  function changeExerciseByDelta(exerciseId: string, delta: number) {
    if (!activePlan) {
      return;
    }

    setPlans((previous) =>
      previous.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        return {
          ...plan,
          exercises: plan.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) {
              return exercise;
            }

            const nextWeight = clampWeight(
              Number((exercise.currentWeight + delta).toFixed(1))
            );

            if (nextWeight === exercise.currentWeight) {
              return exercise;
            }

            return {
              ...exercise,
              previousWeight: exercise.currentWeight,
              currentWeight: nextWeight,
              bestWeight: Math.max(exercise.bestWeight, nextWeight),
              completed: false
            };
          })
        };
      })
    );
  }

  function setExerciseCompleted(exerciseId: string, completed: boolean) {
    if (!activePlan) {
      return;
    }

    setPlans((previous) =>
      previous.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        return {
          ...plan,
          exercises: plan.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  completed,
                  completedSets: completed ? exercise.targetSets : 0
                }
              : exercise
          )
        };
      })
    );
  }

  function setExerciseSets(exerciseId: string, nextCompletedSets: number) {
    if (!activePlan) {
      return;
    }

    setPlans((previous) =>
      previous.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        return {
          ...plan,
          exercises: plan.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) {
              return exercise;
            }

            const clamped = clampInt(nextCompletedSets, 0, exercise.targetSets);
            return {
              ...exercise,
              completedSets: clamped,
              completed: clamped >= exercise.targetSets
            };
          })
        };
      })
    );
  }

  function updateExerciseMeta(
    exerciseId: string,
    patch: Partial<Pick<Exercise, 'name' | 'notes' | 'targetSets'>>
  ) {
    if (!activePlan) {
      return;
    }

    setPlans((previous) =>
      previous.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        return {
          ...plan,
          exercises: plan.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) {
              return exercise;
            }

            const targetSets = patch.targetSets
              ? clampInt(patch.targetSets, 1, 12)
              : exercise.targetSets;

            return {
              ...exercise,
              ...patch,
              targetSets,
              completedSets: clampInt(exercise.completedSets, 0, targetSets),
              completed: clampInt(exercise.completedSets, 0, targetSets) >= targetSets
            };
          })
        };
      })
    );
  }

  function deleteExercise(exerciseId: string) {
    if (!activePlan) {
      return;
    }

    setPlans((previous) =>
      previous.map((plan) =>
        plan.id === activePlan.id
          ? {
              ...plan,
              exercises: plan.exercises.filter((exercise) => exercise.id !== exerciseId)
            }
          : plan
      )
    );
  }

  function renameActivePlan(event: FormEvent) {
    event.preventDefault();
    if (!activePlan) {
      return;
    }

    const nextName = planEditName.trim();
    if (!nextName) {
      return;
    }

    setPlans((previous) =>
      previous.map((plan) =>
        plan.id === activePlan.id
          ? {
              ...plan,
              name: nextName
            }
          : plan
      )
    );
  }

  function deleteActivePlan() {
    if (!activePlan) {
      return;
    }

    setPlans((previous) => previous.filter((plan) => plan.id !== activePlan.id));
  }

  function moveExercise(dragId: string, targetId: string) {
    if (!activePlan || dragId === targetId) {
      return;
    }

    setPlans((previous) =>
      previous.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        const fromIndex = plan.exercises.findIndex((exercise) => exercise.id === dragId);
        const toIndex = plan.exercises.findIndex((exercise) => exercise.id === targetId);

        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
          return plan;
        }

        const reordered = [...plan.exercises];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);

        return {
          ...plan,
          exercises: reordered
        };
      })
    );
  }

  function finishTraining() {
    if (!activePlan || activePlan.exercises.length === 0) {
      return;
    }

    const entry: TrainingHistoryEntry = {
      id: createId(),
      dateIso: new Date().toISOString(),
      planId: activePlan.id,
      planName: activePlan.name,
      exercises: activePlan.exercises.map((exercise) => ({
        name: exercise.name,
        weight: exercise.currentWeight,
        completedSets: exercise.completedSets,
        targetSets: exercise.targetSets,
        isPr:
          exercise.previousWeight !== null &&
          exercise.currentWeight >= exercise.bestWeight &&
          exercise.currentWeight > exercise.previousWeight
      }))
    };

    setHistory((previous) => [entry, ...previous].slice(0, 40));

    setPlans((previous) =>
      previous.map((plan) =>
        plan.id === activePlan.id
          ? {
              ...plan,
              exercises: plan.exercises.map((exercise) => ({
                ...exercise,
                completed: false,
                completedSets: 0
              }))
            }
          : plan
      )
    );
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="topbar">
          <h1>GymApp</h1>
        </header>

        <div className="screen-content">
          {activeTab === 'today' ? (
            <section className="section-block ios-group">
              <h2>Heute</h2>

              {plans.length > 0 ? (
                <>
                  <div className="plan-picker-grid">
                    {plans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        className={`plan-select-card ${plan.id === activePlanId ? 'active' : ''}`}
                        onClick={() => setActivePlanId(plan.id)}
                      >
                        {plan.name}
                      </button>
                    ))}
                  </div>

                  {activePlan ? (
                    <div className="mini-stats-grid">
                      <article className="stat-card">
                        <span>Übungen</span>
                        <strong>{planStats.exerciseCount}</strong>
                      </article>
                      <article className="stat-card">
                        <span>Ø KG</span>
                        <strong>{planStats.avgWeight.toFixed(1)}</strong>
                      </article>
                      <article className="stat-card">
                        <span>Steigerungen</span>
                        <strong>{planStats.progressCount}</strong>
                      </article>
                    </div>
                  ) : null}

                  <div className="history-block">
                    <h3>Verlauf</h3>
                    {history.length === 0 ? (
                      <p className="empty-text">Noch kein abgeschlossenes Training.</p>
                    ) : (
                      <div className="history-list">
                        {history.slice(0, 4).map((entry) => (
                          <article key={entry.id} className="history-item">
                            <div>
                              <strong>{entry.planName}</strong>
                              <p>
                                {new Date(entry.dateIso).toLocaleDateString('de-DE')} · {entry.exercises.length}{' '}
                                Übungen
                              </p>
                            </div>
                            <span>
                              {entry.exercises.filter((exercise) => exercise.isPr).length > 0
                                ? `${entry.exercises.filter((exercise) => exercise.isPr).length} PR`
                                : '—'}
                            </span>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p className="empty-text">Erstelle in Verwalten deinen ersten Plan.</p>
                  <button type="button" onClick={() => setActiveTab('manage')}>
                    Zu Verwalten
                  </button>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === 'exercises' ? (
            <section className="section-block ios-group">
              <h2>Training</h2>

              {activePlan ? (
                <>
                  <div className="current-plan-row compact">
                    <label htmlFor="exercise-plan">Plan</label>
                    <select
                      id="exercise-plan"
                      value={activePlanId}
                      onChange={(event) => setActivePlanId(event.target.value)}
                      aria-label="Aktiver Trainingsplan"
                    >
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rest-timer">
                    <p>Rest Timer</p>
                    <strong>{formatTimer(restSeconds)}</strong>
                    <div className="timer-actions">
                      <button type="button" className="secondary-btn" onClick={() => setRestSeconds(90)}>
                        90s
                      </button>
                      <button type="button" className="secondary-btn" onClick={() => setRestSeconds((s) => s + 30)}>
                        +30s
                      </button>
                      <button type="button" onClick={() => setRestRunning((running) => !running)}>
                        {restRunning ? 'Pause' : 'Start'}
                      </button>
                    </div>
                  </div>

                  <p className="plan-hint">
                    Fortschritt: {planStats.completedCount}/{planStats.exerciseCount} erledigt
                  </p>

                  <div className="exercise-list">
                    {activePlan.exercises.map((exercise) => {
                      const deltaText = formatDelta(exercise);
                      const isPr =
                        exercise.previousWeight !== null &&
                        exercise.currentWeight >= exercise.bestWeight &&
                        exercise.currentWeight > exercise.previousWeight;

                      return (
                        <article
                          key={exercise.id}
                          draggable
                          onDragStart={() => setDraggingExerciseId(exercise.id)}
                          onDragEnd={() => {
                            setDraggingExerciseId(null);
                            setDragOverExerciseId(null);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (dragOverExerciseId !== exercise.id) {
                              setDragOverExerciseId(exercise.id);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (draggingExerciseId) {
                              moveExercise(draggingExerciseId, exercise.id);
                            }
                            setDraggingExerciseId(null);
                            setDragOverExerciseId(null);
                          }}
                          className={`exercise-card ${exercise.completed ? 'completed' : ''} ${
                            draggingExerciseId === exercise.id ? 'dragging' : ''
                          } ${dragOverExerciseId === exercise.id ? 'drag-over' : ''}`}
                        >
                          <div>
                            <p className="drag-hint">⋮⋮ sortieren</p>
                            <h3>{exercise.name}</h3>
                            <p className="weight-main">{exercise.currentWeight.toFixed(1)} kg</p>
                            <div className="badge-row">
                              {deltaText ? <small className="delta-badge">{deltaText}</small> : null}
                              {isPr ? <small className="pr-badge">PR</small> : null}
                              {exercise.completed ? <small className="done-badge">Fertig</small> : null}
                            </div>
                            {exercise.notes.trim() ? (
                              <p className="exercise-note">{exercise.notes}</p>
                            ) : null}
                          </div>

                          <div className="inline-update">
                            <button
                              type="button"
                              className="adjust-button"
                              onClick={() => changeExerciseByDelta(exercise.id, -2.5)}
                              aria-label={`${exercise.name} um 2.5 kg reduzieren`}
                            >
                              −2.5
                            </button>
                            <select
                              value={exercise.currentWeight.toFixed(1)}
                              onChange={(event) =>
                                updateExerciseWeight(exercise.id, event.target.value)
                              }
                              aria-label={`Gewicht für ${exercise.name}`}
                            >
                              {weightOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option} kg
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="adjust-button"
                              onClick={() => changeExerciseByDelta(exercise.id, 2.5)}
                              aria-label={`${exercise.name} um 2.5 kg erhöhen`}
                            >
                              +2.5
                            </button>
                          </div>

                          <div className="sets-row sets-row-chip">
                            <span>
                              Sätze {exercise.completedSets}/{exercise.targetSets}
                            </span>
                            <div className="set-chips" role="group" aria-label={`Sätze ${exercise.name}`}>
                              {Array.from({ length: exercise.targetSets }).map((_, index) => {
                                const setNumber = index + 1;
                                const done = setNumber <= exercise.completedSets;

                                return (
                                  <button
                                    key={`${exercise.id}-set-${setNumber}`}
                                    type="button"
                                    className={`set-chip ${done ? 'done' : ''}`}
                                    onClick={() =>
                                      setExerciseSets(
                                        exercise.id,
                                        done ? setNumber - 1 : setNumber
                                      )
                                    }
                                    aria-label={`Satz ${setNumber} ${done ? 'zurücksetzen' : 'abhaken'}`}
                                  >
                                    {setNumber}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="card-actions">
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => setExerciseCompleted(exercise.id, !exercise.completed)}
                            >
                              {exercise.completed ? 'Als offen markieren' : 'Komplett abhaken'}
                            </button>
                          </div>
                        </article>
                      );
                    })}

                    {activePlan.exercises.length === 0 ? (
                      <p className="empty-text">
                        Noch keine Übungen in diesem Plan gespeichert.
                      </p>
                    ) : null}
                  </div>

                  {activePlan.exercises.length > 0 ? (
                    <button type="button" className="finish-btn" onClick={finishTraining}>
                      Training abschließen
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="empty-text">
                  Sobald ein Plan da ist, siehst du hier direkt alle Übungen und Gewichte.
                </p>
              )}
            </section>
          ) : null}

          {activeTab === 'manage' ? (
            <>
              <section className="section-block ios-group manage-block">
                <h2>Verwalten</h2>
                <form onSubmit={createPlan} className="form-row">
                  <input
                    value={planName}
                    onChange={(event) => setPlanName(event.target.value)}
                    placeholder="Neuer Plan (z. B. Push Day)"
                    aria-label="Trainingsplan Name"
                  />
                  <button type="submit">Plan anlegen</button>
                </form>

                {activePlan ? (
                  <form onSubmit={renameActivePlan} className="form-row">
                    <input
                      value={planEditName}
                      onChange={(event) => setPlanEditName(event.target.value)}
                      placeholder="Aktiven Plan umbenennen"
                      aria-label="Plan umbenennen"
                    />
                    <button type="submit" className="secondary-btn">
                      Umbenennen
                    </button>
                  </form>
                ) : null}

                {activePlan ? (
                  <button type="button" className="danger-btn" onClick={deleteActivePlan}>
                    Aktiven Plan löschen
                  </button>
                ) : null}
              </section>

              <section className="section-block ios-group">
                <h2>Übung hinzufügen</h2>

                {activePlan ? (
                  <>
                    <div className="current-plan-row compact">
                      <label htmlFor="manage-plan">Plan</label>
                      <select
                        id="manage-plan"
                        value={activePlanId}
                        onChange={(event) => setActivePlanId(event.target.value)}
                        aria-label="Aktiver Trainingsplan"
                      >
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <form onSubmit={addExercise} className="form-grid">
                      <input
                        value={exerciseName}
                        onChange={(event) => setExerciseName(event.target.value)}
                        placeholder="Neue Übung"
                        aria-label="Übungsname"
                      />
                      <select
                        value={exerciseWeight}
                        onChange={(event) => setExerciseWeight(event.target.value)}
                        aria-label="Startgewicht"
                      >
                        {weightOptions.map((option) => (
                          <option key={option} value={option}>
                            {option} kg
                          </option>
                        ))}
                      </select>
                      <button type="submit">Hinzufügen</button>
                    </form>

                    <div className="manage-exercise-list">
                      {activePlan.exercises.map((exercise) => (
                        <article key={exercise.id} className="manage-card">
                          <input
                            value={exercise.name}
                            onChange={(event) =>
                              updateExerciseMeta(exercise.id, { name: event.target.value })
                            }
                            aria-label={`Name für ${exercise.name}`}
                          />

                          <textarea
                            value={exercise.notes}
                            onChange={(event) =>
                              updateExerciseMeta(exercise.id, { notes: event.target.value })
                            }
                            rows={2}
                            placeholder="Notiz zur Übung"
                            aria-label={`Notiz für ${exercise.name}`}
                          />

                          <div className="manage-row">
                            <label>Sätze</label>
                            <select
                              value={String(exercise.targetSets)}
                              onChange={(event) =>
                                updateExerciseMeta(exercise.id, {
                                  targetSets: Number.parseInt(event.target.value, 10)
                                })
                              }
                              aria-label={`Satzanzahl für ${exercise.name}`}
                            >
                              {Array.from({ length: 10 }).map((_, index) => {
                                const value = index + 1;
                                return (
                                  <option key={value} value={value}>
                                    {value} Sätze
                                  </option>
                                );
                              })}
                            </select>
                            <button type="button" className="danger-btn" onClick={() => deleteExercise(exercise.id)}>
                              Löschen
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="empty-text">Lege zuerst einen Plan an, dann Übungen hinzufügen.</p>
                )}
              </section>
            </>
          ) : null}
        </div>

        <nav className="tabbar" aria-label="Navigation">
          <button
            type="button"
            className={`tab-item ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            Heute
          </button>
          <button
            type="button"
            className={`tab-item ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
          >
            Übungen
          </button>
          <button
            type="button"
            className={`tab-item ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            Verwalten
          </button>
        </nav>
      </section>
    </main>
  );
}
