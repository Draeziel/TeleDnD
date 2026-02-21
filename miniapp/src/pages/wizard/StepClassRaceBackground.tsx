import React from 'react';
import type { ContentEntity, DraftState } from '../../types/models';

type Props = {
  draft: DraftState | null;
  classes: ContentEntity[];
  races: ContentEntity[];
  backgrounds: ContentEntity[];
  onAssignClass: (id: string) => Promise<void>;
  onAssignRace: (id: string | null) => Promise<void>;
  onAssignBackground: (id: string | null) => Promise<void>;
};

export const StepClassRaceBackground: React.FC<Props> = ({ draft, classes, races, backgrounds, onAssignClass, onAssignRace, onAssignBackground }) => {
  return (
    <div>
      {draft && (
        <>
          <section>
            <h4>Класс</h4>
            <div className="list-grid">
              {classes.map((item) => (
                <div key={item.id} className="list-item">
                  <div>{item.name}</div>
                  <button onClick={() => onAssignClass(item.id)} aria-label={`Выбрать класс ${item.name}`}>Выбрать</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4>Раса</h4>
            <div className="toolbar"><button onClick={() => onAssignRace(null)}>Пропустить расу</button></div>
            <div className="list-grid">
              {races.map((item) => (
                <div key={item.id} className="list-item">
                  <div>{item.name}</div>
                  <button onClick={() => onAssignRace(item.id)} aria-label={`Выбрать расу ${item.name}`}>Выбрать</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4>Предыстория</h4>
            <div className="toolbar"><button onClick={() => onAssignBackground(null)}>Пропустить предысторию</button></div>
            <div className="list-grid">
              {backgrounds.map((item) => (
                <div key={item.id} className="list-item">
                  <div>{item.name}</div>
                  <button onClick={() => onAssignBackground(item.id)} aria-label={`Выбрать предысторию ${item.name}`}>Выбрать</button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default StepClassRaceBackground;
