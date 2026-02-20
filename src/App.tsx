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

export default function App() {
  const [plans, setPlans] = useState<TrainingPlan[]>(() => loadPlans());
  const [activePlanId, setActivePlanId] = useState<string>('');

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

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <header className="glass-card topbar">
          <h1>GymApp</h1>
          <p>Dein Trainingsplan, direkt wie eine iPhone App.</p>
        </header>

        <section className="glass-card section-block">
          <h2>Trainingsplan erstellen</h2>
          <form onSubmit={createPlan} className="form-row">
            <input
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
              placeholder="z. B. Push Day"
              aria-label="Trainingsplan Name"
            />
            <button type="submit">Plan speichern</button>
          </form>

          <div className="plan-list">
            {plans.map((plan) => (
              <button
                key={plan.id}
                className={`plan-chip ${plan.id === activePlanId ? 'active' : ''}`}
                onClick={() => setActivePlanId(plan.id)}
                type="button"
              >
                {plan.name}
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card section-block">
          <h2>Übungen & Gewichte</h2>

          {activePlan ? (
            <>
              <form onSubmit={addExercise} className="form-grid">
                <input
                  value={exerciseName}
                  onChange={(event) => setExerciseName(event.target.value)}
                  placeholder="Übung"
                  aria-label="Übungsname"
                />
                <select
                  value={exerciseWeight}
                  onChange={(event) => setExerciseWeight(event.target.value)}
                  aria-label="Gewicht"
                >
                  {weightOptions.map((option) => (
                    <option key={option} value={option}>
                      {option} kg
                    </option>
                  ))}
                </select>
                <button type="submit">Übung hinzufügen</button>
              </form>

              <div className="exercise-list">
                {activePlan.exercises.map((exercise) => {
                  const deltaText = formatDelta(exercise);

                  return (
                    <article key={exercise.id} className="exercise-card">
                      <div>
                        <h3>{exercise.name}</h3>
                        <p>{exercise.currentWeight.toFixed(1)} kg</p>
                        {deltaText ? <small>{deltaText}</small> : null}
                      </div>

                      <div className="inline-update">
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
              Erstelle zuerst einen Trainingsplan, dann kannst du Übungen und Gewichte eintragen.
            </p>
          )}
        </section>
      </section>
    </main>
  );
}