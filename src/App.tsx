import { FormEvent, useEffect, useMemo, useState } from 'react';

type Exercise = {
  id: string;
  name: string;
  currentWeight: number;
  previousWeight: number | null;
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

    return parsed;
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
      previousWeight: null
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
              currentWeight: parsedWeight
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
              currentWeight: nextWeight
            };
          })
        };
      })
    );
  }

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="topbar">
          <h1>GymApp</h1>
          <p>Schnell nachschauen und Gewicht direkt anpassen.</p>
        </header>

        <div className="screen-content">
          {activeTab === 'today' ? (
            <section className="section-block ios-group">
              <h2>Heute</h2>

              {activePlan ? (
                <>
                  <div className="current-plan-row">
                    <label htmlFor="active-plan">Plan</label>
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

                  <p className="plan-hint">
                    {activePlan.exercises.length} Übungen in diesem Plan
                  </p>
                </>
              ) : (
                <p className="empty-text">Erstelle unten zuerst einen Plan.</p>
              )}
            </section>
          ) : null}

          {activeTab === 'exercises' ? (
            <section className="section-block ios-group">
              <h2>Übung & Gewicht</h2>

              {activePlan ? (
                <>
                  <div className="exercise-list">
                    {activePlan.exercises.map((exercise) => {
                      const deltaText = formatDelta(exercise);

                      return (
                        <article key={exercise.id} className="exercise-card">
                          <div>
                            <h3>{exercise.name}</h3>
                            <p className="weight-main">{exercise.currentWeight.toFixed(1)} kg</p>
                            {deltaText ? <small>{deltaText}</small> : null}
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
                        </article>
                      );
                    })}

                    {activePlan.exercises.length === 0 ? (
                      <p className="empty-text">
                        Noch keine Übungen in diesem Plan gespeichert.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="empty-text">
                  Sobald ein Plan da ist, siehst du hier direkt alle Übungen und Gewichte.
                </p>
              )}
            </section>
          ) : null}

          {activeTab === 'manage' ? (
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

              {activePlan ? (
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
              ) : null}
            </section>
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