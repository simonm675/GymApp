import { FormEvent, useEffect, useMemo, useState } from 'react';

type Exercise = {
  id: string;
  name: string;
  currentWeight: number;
  previousWeight: number | null;
  completed: boolean;
};

type TrainingPlan = {
  id: string;
  name: string;
  exercises: Exercise[];
};

const STORAGE_KEY = 'gymapp:v1';

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
        ? plan.exercises.map((exercise) => ({
            ...exercise,
            completed: exercise.completed ?? false
          }))
        : []
    }));
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

function clampWeight(value: number) {
  return Math.max(0, Math.min(300, value));
}

export default function App() {
  const [plans, setPlans] = useState<TrainingPlan[]>(() => loadPlans());
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'today' | 'exercises' | 'manage'>('today');
  const [exerciseView, setExerciseView] = useState<'session' | 'list'>('session');
  const [sessionIndex, setSessionIndex] = useState(0);

  const [planName, setPlanName] = useState('');
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseWeight, setExerciseWeight] = useState('20.0');

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

  const currentSessionExercise = useMemo(() => {
    if (!activePlan || activePlan.exercises.length === 0) {
      return null;
    }

    const safeIndex = Math.max(0, Math.min(sessionIndex, activePlan.exercises.length - 1));
    return activePlan.exercises[safeIndex];
  }, [activePlan, sessionIndex]);

  const planStats = useMemo(() => {
    if (!activePlan) {
      return { exerciseCount: 0, avgWeight: 0, progressCount: 0 };
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
    if (!activePlan || activePlan.exercises.length === 0) {
      setSessionIndex(0);
      return;
    }

    setSessionIndex((previous) =>
      Math.max(0, Math.min(previous, activePlan.exercises.length - 1))
    );
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

    const newExercise: Exercise = {
      id: createId(),
      name,
      currentWeight: parsedWeight,
      previousWeight: null,
      completed: false
    };

    setPlans((previous) =>
      previous.map((plan) =>
        plan.id === activePlan.id
          ? { ...plan, exercises: [newExercise, ...plan.exercises] }
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

            if (exercise.currentWeight === parsedWeight) {
              return exercise;
            }

            return {
              ...exercise,
              previousWeight: exercise.currentWeight,
              currentWeight: parsedWeight,
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
            exercise.id === exerciseId ? { ...exercise, completed } : exercise
          )
        };
      })
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
            <>
              <section className="section-block ios-group">
                <h2>Heute</h2>

                {activePlan ? (
                  <>
                    <article className="hero-card">
                      <div>
                        <p className="hero-kicker">Aktiver Plan</p>
                        <h3>{activePlan.name}</h3>
                        <p className="hero-meta">
                          {planStats.completedCount}/{planStats.exerciseCount} Übungen erledigt
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('exercises');
                          setExerciseView('session');
                        }}
                      >
                        Training starten
                      </button>
                    </article>

                    <div className="stats-grid">
                      <article className="stat-card">
                        <span>Übungen</span>
                        <strong>{planStats.exerciseCount}</strong>
                      </article>
                      <article className="stat-card">
                        <span>Ø Gewicht</span>
                        <strong>{planStats.avgWeight.toFixed(1)} kg</strong>
                      </article>
                      <article className="stat-card">
                        <span>Steigerungen</span>
                        <strong>{planStats.progressCount}</strong>
                      </article>
                      <article className="stat-card">
                        <span>Erledigt</span>
                        <strong>{planStats.completedCount}</strong>
                      </article>
                    </div>

                    <div className="current-plan-row">
                      <label htmlFor="active-plan">Plan wechseln</label>
                      <select
                        id="active-plan"
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
                  </>
                ) : (
                  <p className="empty-text">Erstelle in Verwalten deinen ersten Plan.</p>
                )}
              </section>

              {activePlan && planStats.exerciseCount > 0 ? (
                <section className="section-block ios-group">
                  <h2>Als Nächstes</h2>
                  <div className="preview-list">
                    {activePlan.exercises.slice(0, 3).map((exercise) => (
                      <article key={exercise.id} className="preview-item">
                        <span>{exercise.name}</span>
                        <strong>{exercise.currentWeight.toFixed(1)} kg</strong>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {activeTab === 'exercises' ? (
            <section className="section-block ios-group">
              <h2>Übung & Gewicht</h2>

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

                  <div className="view-switch" role="tablist" aria-label="Ansicht wechseln">
                    <button
                      type="button"
                      className={`switch-btn ${exerciseView === 'session' ? 'active' : ''}`}
                      onClick={() => setExerciseView('session')}
                    >
                      Session
                    </button>
                    <button
                      type="button"
                      className={`switch-btn ${exerciseView === 'list' ? 'active' : ''}`}
                      onClick={() => setExerciseView('list')}
                    >
                      Liste
                    </button>
                  </div>

                  <p className="plan-hint">
                    Fortschritt: {planStats.completedCount}/{planStats.exerciseCount} erledigt
                  </p>

                  {exerciseView === 'session' ? (
                    currentSessionExercise ? (
                      <article className="session-card">
                        <div className="session-head">
                          <span>
                            Übung {sessionIndex + 1} von {activePlan.exercises.length}
                          </span>
                          {formatDelta(currentSessionExercise) ? (
                            <small className="delta-badge">
                              {formatDelta(currentSessionExercise)}
                            </small>
                          ) : null}
                        </div>

                        <h3>{currentSessionExercise.name}</h3>
                        <p className="session-weight">
                          {currentSessionExercise.currentWeight.toFixed(1)} kg
                        </p>

                        <div className="inline-update session-update">
                          <button
                            type="button"
                            className="adjust-button"
                            onClick={() => changeExerciseByDelta(currentSessionExercise.id, -2.5)}
                          >
                            −2.5
                          </button>
                          <select
                            value={currentSessionExercise.currentWeight.toFixed(1)}
                            onChange={(event) =>
                              updateExerciseWeight(currentSessionExercise.id, event.target.value)
                            }
                            aria-label={`Gewicht für ${currentSessionExercise.name}`}
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
                            onClick={() => changeExerciseByDelta(currentSessionExercise.id, 2.5)}
                          >
                            +2.5
                          </button>
                        </div>

                        <div className="quick-deltas">
                          {[1.25, 2.5, 5].map((delta) => (
                            <button
                              key={delta}
                              type="button"
                              className="chip-btn"
                              onClick={() => changeExerciseByDelta(currentSessionExercise.id, delta)}
                            >
                              +{delta}
                            </button>
                          ))}
                        </div>

                        <div className="session-actions">
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => setSessionIndex((previous) => Math.max(0, previous - 1))}
                          >
                            Zurück
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setExerciseCompleted(
                                currentSessionExercise.id,
                                !currentSessionExercise.completed
                              )
                            }
                          >
                            {currentSessionExercise.completed ? 'Als offen markieren' : 'Als erledigt'}
                          </button>
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() =>
                              setSessionIndex((previous) =>
                                Math.min(activePlan.exercises.length - 1, previous + 1)
                              )
                            }
                          >
                            Weiter
                          </button>
                        </div>
                      </article>
                    ) : (
                      <p className="empty-text">Keine Übung in diesem Plan.</p>
                    )
                  ) : null}

                  {exerciseView === 'list' ? (
                    <div className="exercise-list">
                      {activePlan.exercises.map((exercise) => {
                        const deltaText = formatDelta(exercise);

                        return (
                          <article
                            key={exercise.id}
                            className={`exercise-card ${exercise.completed ? 'completed' : ''}`}
                          >
                            <div>
                              <h3>{exercise.name}</h3>
                              <p className="weight-main">{exercise.currentWeight.toFixed(1)} kg</p>
                              {deltaText ? <small className="delta-badge">{deltaText}</small> : null}
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

                            <button
                              type="button"
                              className="done-btn"
                              onClick={() => setExerciseCompleted(exercise.id, !exercise.completed)}
                            >
                              {exercise.completed ? 'Erledigt ✓' : 'Als erledigt markieren'}
                            </button>
                          </article>
                        );
                      })}

                      {activePlan.exercises.length === 0 ? (
                        <p className="empty-text">
                          Noch keine Übungen in diesem Plan gespeichert.
                        </p>
                      ) : null}
                    </div>
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
                  <button type="submit">Plan</button>
                </form>
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
                      <button type="submit">Übung</button>
                    </form>
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
            <span className="tab-icon">⌂</span>
            Heute
          </button>
          <button
            type="button"
            className={`tab-item ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
          >
            <span className="tab-icon">🏋</span>
            Übungen
          </button>
          <button
            type="button"
            className={`tab-item ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            <span className="tab-icon">⚙</span>
            Verwalten
          </button>
        </nav>
      </section>
    </main>
  );
}