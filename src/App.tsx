import { FormEvent, useEffect, useMemo, useState } from 'react';

type Exercise = {
  id: string;
  name: string;
  currentWeight: number;
  previousWeight: number | null;
  bestWeight: number;
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
  planName: string;
  exercises: HistoryExercise[];
};

const STORAGE_KEY = 'gymapp:v3:plans';
const HISTORY_KEY = 'gymapp:v3:history';

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampWeight(value: number) {
  return Math.max(0, Math.min(400, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeExercise(raw: Partial<Exercise> & { id: string; name: string }): Exercise {
  const currentWeight = Number(raw.currentWeight ?? 0);
  const targetSets = clampInt(Number(raw.targetSets ?? 3), 1, 12);
  const completedSets = clampInt(Number(raw.completedSets ?? 0), 0, targetSets);

  return {
    id: raw.id,
    name: raw.name,
    currentWeight,
    previousWeight: raw.previousWeight ?? null,
    bestWeight: Number(raw.bestWeight ?? currentWeight),
    notes: String(raw.notes ?? ''),
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

  const [activeTab, setActiveTab] = useState<'today' | 'workout' | 'manage'>('today');
  const [activePlanId, setActivePlanId] = useState('');

  const [planName, setPlanName] = useState('');
  const [planEditName, setPlanEditName] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseWeight, setExerciseWeight] = useState('20.0');

  const [restSeconds, setRestSeconds] = useState(90);
  const [restRunning, setRestRunning] = useState(false);

  const weightOptions = useMemo(() => {
    const values: string[] = [];
    for (let value = 0; value <= 300; value += 0.5) {
      values.push(value.toFixed(1));
    }
    return values;
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

  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === activePlanId) ?? null,
    [plans, activePlanId]
  );

  useEffect(() => {
    setPlanEditName(activePlan?.name ?? '');
  }, [activePlan]);

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

  const stats = useMemo(() => {
    if (!activePlan) {
      return { exerciseCount: 0, avgWeight: 0, progressed: 0, done: 0 };
    }

    const exerciseCount = activePlan.exercises.length;
    const avgWeight =
      exerciseCount > 0
        ? activePlan.exercises.reduce((sum, e) => sum + e.currentWeight, 0) / exerciseCount
        : 0;
    const progressed = activePlan.exercises.filter(
      (e) => e.previousWeight !== null && e.currentWeight > e.previousWeight
    ).length;
    const done = activePlan.exercises.filter((e) => e.completedSets >= e.targetSets).length;

    return { exerciseCount, avgWeight, progressed, done };
  }, [activePlan]);

  const workoutProgress =
    stats.exerciseCount > 0 ? Math.round((stats.done / stats.exerciseCount) * 100) : 0;

  function createPlan(event: FormEvent) {
    event.preventDefault();
    const name = planName.trim();
    if (!name) {
      return;
    }

    const nextPlan: TrainingPlan = {
      id: createId(),
      name,
      exercises: []
    };

    setPlans((prev) => [nextPlan, ...prev]);
    setActivePlanId(nextPlan.id);
    setPlanName('');
  }

  function renameActivePlan(event: FormEvent) {
    event.preventDefault();
    if (!activePlan) {
      return;
    }

    const name = planEditName.trim();
    if (!name) {
      return;
    }

    setPlans((prev) =>
      prev.map((plan) => (plan.id === activePlan.id ? { ...plan, name } : plan))
    );
  }

  function deleteActivePlan() {
    if (!activePlan) {
      return;
    }

    setPlans((prev) => prev.filter((plan) => plan.id !== activePlan.id));
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

    const weight = Number(parsedWeight.toFixed(1));

    const newExercise: Exercise = {
      id: createId(),
      name,
      currentWeight: weight,
      previousWeight: null,
      bestWeight: weight,
      notes: '',
      targetSets: 3,
      completedSets: 0
    };

    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === activePlan.id
          ? { ...plan, exercises: [...plan.exercises, newExercise] }
          : plan
      )
    );

    setExerciseName('');
    setExerciseWeight('20.0');
  }

  function updateExerciseWeight(exerciseId: string, nextValue: string) {
    if (!activePlan) {
      return;
    }

    const parsed = Number.parseFloat(nextValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      return;
    }

    const nextWeight = Number(parsed.toFixed(1));

    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        return {
          ...plan,
          exercises: plan.exercises.map((exercise) => {
            if (exercise.id !== exerciseId || exercise.currentWeight === nextWeight) {
              return exercise;
            }

            return {
              ...exercise,
              previousWeight: exercise.currentWeight,
              currentWeight: nextWeight,
              bestWeight: Math.max(exercise.bestWeight, nextWeight)
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

    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        return {
          ...plan,
          exercises: plan.exercises.map((exercise) => {
            if (exercise.id !== exerciseId) {
              return exercise;
            }

            const nextWeight = clampWeight(Number((exercise.currentWeight + delta).toFixed(1)));
            if (nextWeight === exercise.currentWeight) {
              return exercise;
            }

            return {
              ...exercise,
              previousWeight: exercise.currentWeight,
              currentWeight: nextWeight,
              bestWeight: Math.max(exercise.bestWeight, nextWeight)
            };
          })
        };
      })
    );
  }

  function setExerciseSets(exerciseId: string, completedSets: number) {
    if (!activePlan) {
      return;
    }

    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        return {
          ...plan,
          exercises: plan.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  completedSets: clampInt(completedSets, 0, exercise.targetSets)
                }
              : exercise
          )
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

    setPlans((prev) =>
      prev.map((plan) => {
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
              completedSets: clampInt(exercise.completedSets, 0, targetSets)
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

    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === activePlan.id
          ? { ...plan, exercises: plan.exercises.filter((exercise) => exercise.id !== exerciseId) }
          : plan
      )
    );
  }

  function moveExerciseByOffset(exerciseId: string, offset: -1 | 1) {
    if (!activePlan) {
      return;
    }

    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== activePlan.id) {
          return plan;
        }

        const index = plan.exercises.findIndex((exercise) => exercise.id === exerciseId);
        const target = index + offset;
        if (index < 0 || target < 0 || target >= plan.exercises.length) {
          return plan;
        }

        const reordered = [...plan.exercises];
        const [moved] = reordered.splice(index, 1);
        reordered.splice(target, 0, moved);

        return { ...plan, exercises: reordered };
      })
    );
  }

  function finishWorkout() {
    if (!activePlan || activePlan.exercises.length === 0) {
      return;
    }

    const entry: TrainingHistoryEntry = {
      id: createId(),
      dateIso: new Date().toISOString(),
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

    setHistory((prev) => [entry, ...prev].slice(0, 60));
    setPlans((prev) =>
      prev.map((plan) =>
        plan.id === activePlan.id
          ? {
              ...plan,
              exercises: plan.exercises.map((exercise) => ({
                ...exercise,
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
                    <>
                      <div className="mini-stats-grid">
                        <article className="stat-card">
                          <span>Übungen</span>
                          <strong>{stats.exerciseCount}</strong>
                        </article>
                        <article className="stat-card">
                          <span>Ø KG</span>
                          <strong>{stats.avgWeight.toFixed(1)}</strong>
                        </article>
                        <article className="stat-card">
                          <span>Fortschritt</span>
                          <strong>{workoutProgress}%</strong>
                        </article>
                      </div>

                      <button type="button" onClick={() => setActiveTab('workout')}>
                        Workout starten
                      </button>
                    </>
                  ) : null}

                  <div className="history-block">
                    <h3>Letzte Workouts</h3>
                    {history.length === 0 ? (
                      <p className="empty-text">Noch kein Workout abgeschlossen.</p>
                    ) : (
                      <div className="history-list">
                        {history.slice(0, 4).map((entry) => {
                          const prCount = entry.exercises.filter((exercise) => exercise.isPr).length;
                          return (
                            <article key={entry.id} className="history-item">
                              <div>
                                <strong>{entry.planName}</strong>
                                <p>
                                  {new Date(entry.dateIso).toLocaleDateString('de-DE')} · {entry.exercises.length} Übungen
                                </p>
                              </div>
                              <span>{prCount > 0 ? `${prCount} PR` : '—'}</span>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p className="empty-text">Lege in Verwalten deinen ersten Plan an.</p>
                  <button type="button" onClick={() => setActiveTab('manage')}>
                    Zu Verwalten
                  </button>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === 'workout' ? (
            <section className="section-block ios-group">
              <h2>Workout</h2>

              {activePlan ? (
                <>
                  <div className="current-plan-row compact">
                    <label htmlFor="workout-plan">Plan</label>
                    <select
                      id="workout-plan"
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

                  <div className="workout-head">
                    <p className="plan-hint">{stats.done}/{stats.exerciseCount} Übungen abgeschlossen</p>
                    <div className="progress-track" aria-label="Workout Fortschritt">
                      <span style={{ width: `${workoutProgress}%` }} />
                    </div>
                  </div>

                  <div className="rest-timer">
                    <p>Rest Timer</p>
                    <strong>{formatTimer(restSeconds)}</strong>
                    <div className="timer-actions">
                      <button type="button" className="secondary-btn" onClick={() => setRestSeconds(90)}>
                        90s
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => setRestSeconds((previous) => previous + 30)}
                      >
                        +30s
                      </button>
                      <button type="button" onClick={() => setRestRunning((running) => !running)}>
                        {restRunning ? 'Pause' : 'Start'}
                      </button>
                    </div>
                  </div>

                  <div className="exercise-list">
                    {activePlan.exercises.map((exercise) => {
                      const deltaText = formatDelta(exercise);
                      const isPr =
                        exercise.previousWeight !== null &&
                        exercise.currentWeight >= exercise.bestWeight &&
                        exercise.currentWeight > exercise.previousWeight;
                      const isDone = exercise.completedSets >= exercise.targetSets;

                      return (
                        <article key={exercise.id} className={`exercise-card ${isDone ? 'completed' : ''}`}>
                          <div>
                            <h3>{exercise.name}</h3>
                            <p className="weight-main">{exercise.currentWeight.toFixed(1)} kg</p>
                            <div className="badge-row">
                              {deltaText ? <small className="delta-badge">{deltaText}</small> : null}
                              {isPr ? <small className="pr-badge">PR</small> : null}
                              {isDone ? <small className="done-badge">Fertig</small> : null}
                            </div>
                            {exercise.notes.trim() ? <p className="exercise-note">{exercise.notes}</p> : null}
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
                              onChange={(event) => updateExerciseWeight(exercise.id, event.target.value)}
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
                                const setNo = index + 1;
                                const done = setNo <= exercise.completedSets;

                                return (
                                  <button
                                    key={`${exercise.id}-set-${setNo}`}
                                    type="button"
                                    className={`set-chip ${done ? 'done' : ''}`}
                                    onClick={() => setExerciseSets(exercise.id, done ? setNo - 1 : setNo)}
                                  >
                                    {setNo}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </article>
                      );
                    })}

                    {activePlan.exercises.length === 0 ? (
                      <p className="empty-text">Füge in Verwalten Übungen hinzu.</p>
                    ) : null}
                  </div>

                  {activePlan.exercises.length > 0 ? (
                    <button type="button" className="finish-btn" onClick={finishWorkout}>
                      Workout abschließen
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="empty-text">Wähle zuerst auf Heute einen Plan aus.</p>
              )}
            </section>
          ) : null}

          {activeTab === 'manage' ? (
            <>
              <section className="section-block ios-group manage-block">
                <h2>Pläne</h2>

                <form onSubmit={createPlan} className="form-row">
                  <input
                    value={planName}
                    onChange={(event) => setPlanName(event.target.value)}
                    placeholder="Neuer Plan (z. B. Push Day)"
                    aria-label="Trainingsplan Name"
                  />
                  <button type="submit">Anlegen</button>
                </form>

                {activePlan ? (
                  <>
                    <div className="current-plan-row compact">
                      <label htmlFor="manage-plan">Aktiver Plan</label>
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

                    <form onSubmit={renameActivePlan} className="form-row">
                      <input
                        value={planEditName}
                        onChange={(event) => setPlanEditName(event.target.value)}
                        placeholder="Planname bearbeiten"
                        aria-label="Planname bearbeiten"
                      />
                      <button type="submit" className="secondary-btn">
                        Speichern
                      </button>
                    </form>

                    <button type="button" className="danger-btn" onClick={deleteActivePlan}>
                      Aktiven Plan löschen
                    </button>
                  </>
                ) : null}
              </section>

              <section className="section-block ios-group">
                <h2>Übungen</h2>

                {activePlan ? (
                  <>
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
                      {activePlan.exercises.map((exercise, index) => (
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
                              {Array.from({ length: 10 }).map((_, idx) => {
                                const value = idx + 1;
                                return (
                                  <option key={value} value={value}>
                                    {value} Sätze
                                  </option>
                                );
                              })}
                            </select>

                            <div className="reorder-actions">
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => moveExerciseByOffset(exercise.id, -1)}
                                disabled={index === 0}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => moveExerciseByOffset(exercise.id, 1)}
                                disabled={index === activePlan.exercises.length - 1}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="danger-btn"
                                onClick={() => deleteExercise(exercise.id)}
                              >
                                Löschen
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="empty-text">Lege zuerst einen Plan an.</p>
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
            className={`tab-item ${activeTab === 'workout' ? 'active' : ''}`}
            onClick={() => setActiveTab('workout')}
          >
            Workout
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
