import {useEffect, useState, useCallback} from 'react';
import {generateText} from "@/lib/faker";
import _ from "lodash";

/* TODO
* Counter
* Timer
* */

export interface ILetterData {
  letter: string,
  typed: boolean,
  status?: 'correct' | 'incorrect';
}

export interface ITextCoord {
  word: number,
  letter: number
}

export interface IGameResult {
  correct: number,
  incorrect: number,
  total: number,
  wpm: number,
  accuracy: number
}

export interface IGame {
  text: string,
  data: ILetterData[][]
  timeLimit?: number, // in seconds
  counter: number,
  isRunning: boolean,
  isOver: boolean,
  currentPos: ITextCoord,
}

type VoidFunc = () => void;

export interface ITypingActions {
  startGame: VoidFunc;
  createNewGame: (textSize?: number, timeLimit?: number)=>void;
  setTimeLimit: (timeLimit?: number)=>void;
  isReady: (game: IGame) => boolean;
  isLetterActive: (game: IGame, wordOffset: number, letterOffset: number) => boolean,
  result: (game: IGame) => IGameResult | undefined;
}

type IUseTyping = () => [IGame, ITypingActions];

const useTyping: IUseTyping = () => {
  const initialState: IGame = {
    text: "",
    counter: 0,
    data: [],
    isOver: false,
    isRunning: false,
    currentPos: {
      word: 0,
      letter: 0
    },
  }

  const [game, setGame] = useState<IGame>(initialState);

  const setTimeLimit = (timeLimit: number = 30) => {
    setGame(game=>({...game, timeLimit}));
  }

  const createTextdata = (text: string): ILetterData[][] => {
    const words = text.split(" ");
    return words.map((word, wordIndex)=> {
      const letters = word.split('').map(letter => {
        const letterData: ILetterData = {
          letter,
          typed: false
        }
        return letterData;
      })
      if (wordIndex !== word.length - 1) letters.push({ typed: false, letter: "" })
      return letters;
    })
  }

  const createNewGame = (textSize: number = 100, timeLimit?: number) => {
    const text = generateText(textSize);
    const data = createTextdata(text);
    if (game.isRunning) return console.error("Game is already running");
    setGame({
      ...initialState,
      text,
      data,
      timeLimit
    })
  }

  const startGame = () => {
    if ( game.isRunning) return console.error("Game is already running");
    setGame(game => (
      { ...game, isRunning: true }
    ));
  }

  const isReady = (game: IGame) => game.text !== "" && game.data.length > 0;

  const result = (game: IGame): IGameResult | undefined =>{
    if (!isReady) return;
    let incorrect = 0, correct = 0, words = game.currentPos.word;
    const total = game.text.length;
    if (game.currentPos.letter < game.data[game.currentPos.word].length - 1) words -= 1;
    const wpm = Math.round((words / game.counter)* 60);
    for (const word of game.data){
      for (const letter of word){
        if (letter.status === "correct") correct += 1;
        else if (letter.status === "incorrect") incorrect += 1;
      }
    }
    const accuracy = (correct + incorrect === 0) ? 0 :  Math.round((correct * 100) / (correct + incorrect));
    return {
      correct,
      incorrect,
      total,
      wpm,
      accuracy,
    }
  };

  const isLetterActive = (game: IGame, wordOffset: number, letterOffset: number)=>(
    game.isRunning
    && game.currentPos.word == wordOffset
    && game.currentPos.letter == letterOffset
  );

  const updateGameData = (
    offset: ITextCoord, data
    : Partial<ILetterData>,
    { increment = true }: { increment?: boolean } = {}
  )=>{
    setGame(game => {
      const gameData = _.cloneDeep(game.data);
      const prev = gameData[offset.word][offset.letter];
      gameData[offset.word][offset.letter] = {...prev, ...data};
      return {
        ...game,
        data: gameData,
        currentPos: { word: offset.word, letter: offset.letter + (increment ? 1 : 0) },
      }
    })
  }

  useEffect(() => {
    if (!game.isRunning || game.isOver) return () => {};
    const interval = setInterval(()=>{
      setGame(game=>({ ...game, counter: game.counter + 1 }));
    }, 1000);
    return () => clearInterval(interval);
  }, [game.isRunning, game.isOver]);

  useEffect(() => {
    if(!game.isRunning || game.isOver) return;
    const { word: wordOffset, letter: letterOffset } = game.currentPos;
    if (
      // timelimit crossed
      (!!game.timeLimit && (game.counter === game.timeLimit))
      // last word, last letter
      || (game.data.length - 1 === wordOffset && game.data[wordOffset].length === letterOffset)
    ){
      setGame(game=>({
        ...game,
        isRunning: false,
        isOver: true,
      }))
    }
  }, [game.isRunning, game.isOver, game.currentPos, game.data, game.timeLimit, game.counter]);


  const handleKeyDown = useCallback((e: KeyboardEvent)=>{
    let { word: wordOffset, letter: letterOffset } = game.currentPos;

    if (e.key === "Backspace"){
      if (letterOffset == 0) {
        if (wordOffset == 0) return;
        wordOffset = Math.max(0, wordOffset-1);
        letterOffset = game.data[wordOffset].length - 1;
      } else letterOffset -= 1;
      updateGameData({
        word: wordOffset,
        letter: letterOffset
      }, {
        typed: false,
        status: undefined,
      }, { increment: false })
      return;
    }

    if (e.key === " " || e.code === "Space"){
      if (wordOffset === game.data.length) return;
      if (letterOffset === 0) return;
      setGame(game=>({
        ...game,
        currentPos: {
          word: Math.min(wordOffset + 1, game.data.length - 1),
          letter: 0
        }
      }));
      return;
    }

    if (game.data[wordOffset].length === letterOffset) {
      letterOffset = 0;
      wordOffset += 1;
    }
    // if (game.data.length === wordOffset) endGame();

    const letterData = game.data[wordOffset][letterOffset];

    updateGameData({
      letter: letterOffset,
      word: wordOffset
    }, {
      ...letterData,
      typed: true,
      status: letterData.letter === e.key ? 'correct' : 'incorrect'
    });
  }, [game.currentPos, game.data])

  useEffect(()=>{
    if (!game.isRunning || game.isOver) return;
    const abortController = new AbortController();
    document.addEventListener("keydown", handleKeyDown, { signal: abortController.signal });
    return () => abortController.abort();
  }, [game.isOver, game.isRunning, handleKeyDown])


  return [game, {
    startGame,
    createNewGame,
    setTimeLimit,
    isReady,
    isLetterActive,
    result
  }]
}

export default useTyping;
