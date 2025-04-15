"use client"

import React, {useEffect, useState} from 'react'
import useTyping, {IGameResult, ILetterData} from "@/hooks/use-typing";
import {cn} from "@/lib/utils";
import {padStart} from "lodash";

interface ILetterProps extends React.ComponentPropsWithoutRef<"span"> {
  letterData: ILetterData,
  active: boolean
}

const Letter = React.forwardRef<HTMLSpanElement, ILetterProps>(
  ({className, letterData, active}, ref)=> {
    const {typed, letter, status} = letterData;
    return <span
      ref={ref}
      className={cn(
        "text-3xl font-mono",
        typed ? "text-accent-light" : "text-light/40",
        status && (status == "correct" ? "" : "text-red-500"),
        active && "relative before:content-[''] before:absolute before:top-0 before:h-full before:w-0.5 before:bg-accent-orange before:animate-pulse before:transition-all before:duration-200 before:delay-100",
        className
      )}
    >
      {letter}
    </span>
  }
)

Letter.displayName = "Letter";


const wordLenthOptions = [10, 25, 50, 100];
const timeLimitOptions = [15, 30, 60, 120];

const Timer = ({counter}:{counter: number})=>{
  const timeInMin = padStart(String(Math.floor(counter / 60)), 2, '0');
  const timeInSec = padStart(String(counter % 60), 2, '0');
  return (
    <div className={"bg-neutral-800 p-2.5 px-5 rounded-full text-lg flex items-center font-typing text-center tracking-wider text-accent-orange"}>
      {timeInMin} : {timeInSec}
    </div>
  )
}

const Select = ({
  options,
  select,
  selectedOption,
  label,
}:{
  options: number[],
  selectedOption: number,
  select: (option: number)=>void;
  label: string

})=>{
  return (
    <div className={"bg-neutral-800 flex gap-5 p-3 px-5 rounded-full font-typing"} title={label}>
      {options.map((option, index)=>(
        <div
          className={cn(
            "text-accent-light/40 text-base cursor-pointer",
            selectedOption === option && "text-accent-green"
          )}
          onClick={()=>select(option)}
          key={index}
        >
          {option}
        </div>
      ))}
    </div>
  )
}

const Result = ({result}: {result: IGameResult | undefined})=>{
  if (!result) return;
  const { wpm, accuracy, correct, incorrect, total } = result;
  return (
    <div className={"flex flex-col items-center w-full max-w-screen-xl px-10 py-10 rounded-2xl bg-neutral-800"}>
      <div className={"w-full text-center text-2xl font-typing text-accent-light/50"}>Analytics</div>
      <div className={"flex w-full justify-center gap-10 py-8"}>
        <div className={"flex flex-col gap-1 items-center bg-neutral-700 p-3 pb-2 min-w-36 rounded-3xl text-base font-typing shadow-md hover:shadow-xl cursor-default hover:scale-105"} title={"words per minute"}>
          WPM
          <div className={"bg-neutral-800 w-full h-full rounded-2xl p-3 font-mono text-xl shadow-md text-center"}>{wpm}</div>
        </div>
        <div className={"flex flex-col gap-1 items-center bg-neutral-700 p-3 pb-2 min-w-36 rounded-3xl text-base font-typing shadow-md hover:shadow-xl cursor-default hover:scale-105"} title={"accuracy"}>
          Accuracy
          <div className={"bg-neutral-800 w-full h-full rounded-2xl p-3 font-mono text-xl shadow-md text-center"}>{accuracy}</div>
        </div>
        <div className={"flex flex-col gap-1 items-center bg-neutral-700 p-3 pb-2 min-w-36 rounded-3xl text-base font-typing shadow-md hover:shadow-xl cursor-default hover:scale-105"}>
          Characters
          <div className={"bg-neutral-800 w-full h-full rounded-2xl p-3 font-mono text-xl shadow-md text-center text-accent-light/50"}>
            <span className={"text-accent-green"} title={"correct"}>{correct}</span> / <span className={"text-accent-red"} title={"incorrect"}>{incorrect}</span> / <span title={"total"}>{total}</span>
          </div>
        </div>
      </div>
    </div>
  )
}


const HomePage = () => {
  const [game, typing] = useTyping();

  const [wordLength, setWordLength] = useState(50);
  const [timeLimit, setTimeLimit] = useState(30);

  const handleSelectWordLength = (option: number)=>{
    if (game.isRunning) return;
    setWordLength(option);
  }

  const handleSelectTimeLimit = (option: number)=>{
    if (game.isRunning) return;
    setTimeLimit(option);
  }

  useEffect(() => {
    if (game.isRunning) return;
    typing.createNewGame(wordLength, timeLimit);
  }, [wordLength]);

  useEffect(() => {
    if (game.isRunning) return;
    typing.setTimeLimit(timeLimit);
  }, [timeLimit]);

  const handleStartGame = React.useCallback((e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (!game.isRunning && game.isOver) typing.createNewGame(wordLength, timeLimit);
    typing.startGame();
  }, [game, typing]);

  const handleOnClickStartGame = () => {
    if (game.isRunning) return;
    if (!game.isRunning && game.isOver) typing.createNewGame(wordLength, timeLimit);
    typing.startGame();
  }

  useEffect(() => {
    if (game.isRunning) return;
    const abortController = new AbortController();
    window.addEventListener("keydown", handleStartGame, { signal: abortController.signal })
    return () => abortController.abort();
  }, [game]);

  if (!typing.isReady(game)) return;

  return (
    <div className={"relative w-full h-full flex flex-col items-center min-h-screen"}>
      <div className={"fixed top-0 w-full py-3 px-8"}>
        <h1 className={"font-typing text-white font-medium text-3xl"}>Typing</h1>
      </div>
      <div className={"mt-16 w-full h-full min-h-[calc(100vh-64px)] flex flex-col justify-center items-center"}>
        <div className={"mb-2 w-full max-w-screen-xl flex justify-between"}>
          <div className={"flex gap-2"}>
            <Timer counter={game.counter} />
            <Select options={timeLimitOptions} selectedOption={timeLimit} select={handleSelectTimeLimit} label={"Set time limit"} />
          </div>
          <div className={"flex items-center font-typing opacity-50 tracking-wide text-lg"}>Press <span className={"text-accent-red mx-1.5 cursor-pointer"} onClick={handleOnClickStartGame} title={"Click to start"}>Enter</span> to start</div>
          <div>
            <Select options={wordLenthOptions} selectedOption={wordLength} select={handleSelectWordLength} label={"Set word limit"} />
          </div>
        </div>
        {game.isOver && (
          <Result result={typing.result(game)} />
        )}
        {!game.isOver && (
          <div className={"flex flex-wrap gap-3 w-full max-w-screen-xl px-10 py-10 rounded-2xl bg-neutral-800"}>
            {game.data.map((word, wordOffset)=>(
              <div className={"inline-flex"} key={wordOffset}>
                {word.map((letter, letterOffset)=>(
                  <Letter
                    key={`${wordOffset}-${letterOffset}`}
                    letterData={letter}
                    active={typing.isLetterActive(game, wordOffset, letterOffset)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
export default HomePage
