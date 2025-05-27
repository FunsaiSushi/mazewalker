"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FaInfoCircle,
  FaArrowUp,
  FaArrowDown,
  FaArrowLeft,
  FaArrowRight,
} from "react-icons/fa";
import { FiMoon, FiSun } from "react-icons/fi";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

// Types for our maze cells
type CellType =
  | "wall"
  | "path"
  | "player"
  | "exit"
  | "checkpoint"
  | "explored"
  | "unexplored";

interface Position {
  row: number;
  col: number;
}

interface MazeState {
  maze: CellType[][];
  hasFinalExit: boolean;
  explored: boolean;
}

// Helper function to get unvisited neighbors
const getUnvisitedNeighbors = (
  maze: CellType[][],
  pos: Position,
  size: number
): Position[] => {
  const neighbors: Position[] = [];
  const directions = [
    { row: -2, col: 0 }, // up
    { row: 2, col: 0 }, // down
    { row: 0, col: -2 }, // left
    { row: 0, col: 2 }, // right
  ];

  for (const dir of directions) {
    const newRow = pos.row + dir.row;
    const newCol = pos.col + dir.col;

    // Only consider cells that are not on the edge
    if (
      newRow > 0 &&
      newRow < size - 1 &&
      newCol > 0 &&
      newCol < size - 1 &&
      maze[newRow][newCol] === "wall"
    ) {
      neighbors.push({ row: newRow, col: newCol });
    }
  }

  return neighbors;
};

// Helper function to get the cell between two positions
const getCellBetween = (pos1: Position, pos2: Position): Position => {
  return {
    row: (pos1.row + pos2.row) / 2,
    col: (pos1.col + pos2.col) / 2,
  };
};

// Helper function to get random valid starting position
const getRandomValidPosition = (maze: CellType[][]): Position => {
  const validPositions: Position[] = [];

  // Find all path cells that are not checkpoints or exits
  // Stay away from the edges
  for (let row = 1; row < maze.length - 1; row++) {
    for (let col = 1; col < maze[0].length - 1; col++) {
      if (maze[row][col] === "path") {
        validPositions.push({ row, col });
      }
    }
  }

  // If no valid positions found (shouldn't happen), return a default position
  if (validPositions.length === 0) {
    return { row: 1, col: 1 };
  }

  return validPositions[Math.floor(Math.random() * validPositions.length)];
};

// Helper function to ensure path to checkpoint
const ensurePathToCheckpoint = (
  maze: CellType[][],
  checkpoint: Position,
  size: number
): void => {
  // Find the cell adjacent to the checkpoint that's inside the maze
  let pathCell: Position;
  if (checkpoint.row === 0) pathCell = { row: 1, col: checkpoint.col };
  else if (checkpoint.row === size - 1)
    pathCell = { row: size - 2, col: checkpoint.col };
  else if (checkpoint.col === 0) pathCell = { row: checkpoint.row, col: 1 };
  else pathCell = { row: checkpoint.row, col: size - 2 };

  // Ensure the path cell and its neighbors are not walls
  maze[pathCell.row][pathCell.col] = "path";

  // Connect to the nearest path cell
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
  ];

  for (const dir of directions) {
    const newRow = pathCell.row + dir.row;
    const newCol = pathCell.col + dir.col;
    if (newRow > 0 && newRow < size - 1 && newCol > 0 && newCol < size - 1) {
      maze[newRow][newCol] = "path";
    }
  }
};

// Generate a single maze
const generateMaze = (
  size: number,
  hasFinalExit: boolean = false,
  row: number,
  col: number,
  isStartingMaze: boolean = false
): CellType[][] => {
  // Initialize maze with walls
  const maze: CellType[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill("wall"));

  // Start from a random odd position
  const startPos = {
    row: 1 + 2 * Math.floor(Math.random() * ((size - 3) / 2)),
    col: 1 + 2 * Math.floor(Math.random() * ((size - 3) / 2)),
  };

  maze[startPos.row][startPos.col] = "path";

  // Generate maze using DFS
  const stack: Position[] = [startPos];
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(maze, current, size);

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    const between = getCellBetween(current, next);
    maze[between.row][between.col] = "path";
    maze[next.row][next.col] = "path";

    stack.push(next);
  }

  // Add checkpoints based on maze position
  const checkpoints: Position[] = [];

  // Collect possible exit positions for each edge
  const edgeExits: { [key: string]: Position[] } = {
    right: [],
    bottom: [],
    left: [],
    top: [],
  };

  // Right edge (if not the rightmost maze)
  if (col < 4) {
    for (let i = 1; i < size - 1; i += 2) {
      edgeExits.right.push({ row: i, col: size - 1 });
    }
  }

  // Bottom edge (if not the bottommost maze)
  if (row < 4) {
    for (let i = 1; i < size - 1; i += 2) {
      edgeExits.bottom.push({ row: size - 1, col: i });
    }
  }

  // Left edge (if not the leftmost maze)
  if (col > 0) {
    for (let i = 1; i < size - 1; i += 2) {
      edgeExits.left.push({ row: i, col: 0 });
    }
  }

  // Top edge (if not the topmost maze)
  if (row > 0) {
    for (let i = 1; i < size - 1; i += 2) {
      edgeExits.top.push({ row: 0, col: i });
    }
  }

  // Calculate how many checkpoints to add per edge
  const totalEdges = Object.values(edgeExits).filter(
    (edge) => edge.length > 0
  ).length;
  const checkpointsPerEdge = Math.floor(6 / totalEdges); // Total of 6 checkpoints
  const remainingCheckpoints = 6 % totalEdges;

  // Add checkpoints to each edge
  Object.values(edgeExits).forEach((positions) => {
    if (positions.length > 0) {
      // Shuffle positions for this edge
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }

      // Add checkpoints for this edge
      const numCheckpoints =
        checkpointsPerEdge + (remainingCheckpoints > 0 ? 1 : 0);
      for (let i = 0; i < Math.min(numCheckpoints, positions.length); i++) {
        const exit = positions[i];
        maze[exit.row][exit.col] = "checkpoint";
        checkpoints.push(exit);
        ensurePathToCheckpoint(maze, exit, size);
      }
    }
  });

  // If this maze has the final exit, add it
  if (hasFinalExit) {
    // Find all available positions that aren't checkpoints
    const allPossibleExits = Object.values(edgeExits).flat();
    const availableExits = allPossibleExits.filter(
      (exit) =>
        !checkpoints.some((cp) => cp.row === exit.row && cp.col === exit.col)
    );

    if (availableExits.length > 0) {
      const exit =
        availableExits[Math.floor(Math.random() * availableExits.length)];
      maze[exit.row][exit.col] = "exit";
      ensurePathToCheckpoint(maze, exit, size);
    }
  }

  // Set player position ONLY in the starting maze
  if (isStartingMaze) {
    const randomStartPos = getRandomValidPosition(maze);
    maze[randomStartPos.row][randomStartPos.col] = "player";
  }

  return maze;
};

// Generate all mazes
const generateAllMazes = (): MazeState[][] => {
  const mazes: MazeState[][] = Array(5)
    .fill(null)
    .map(() =>
      Array(5)
        .fill(null)
        .map(() => ({
          maze: [],
          hasFinalExit: false,
          explored: false,
        }))
    );

  // Set final exit in a random maze (except the starting maze)
  const finalExitRow = Math.floor(Math.random() * 5);
  const finalExitCol = Math.floor(Math.random() * 5);
  if (finalExitRow === 0 && finalExitCol === 1) {
    // If random position is starting maze, move it to the next maze
    mazes[0][2].hasFinalExit = true;
  } else {
    mazes[finalExitRow][finalExitCol].hasFinalExit = true;
  }

  // Generate all mazes
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      mazes[i][j].maze = generateMaze(
        11,
        mazes[i][j].hasFinalExit,
        i,
        j,
        i === 0 && j === 1
      );
    }
  }

  // Mark starting maze as explored
  mazes[0][1].explored = true;

  return mazes;
};

const MainContent = () => {
  const { isDark, toggleTheme, isInitialized } = useTheme();

  const [allMazes, setAllMazes] = useState<MazeState[][]>([]);
  const [currentMazePos, setCurrentMazePos] = useState<Position>({
    row: 0,
    col: 1,
  }); // Start at maze 0,1
  const [playerPos, setPlayerPos] = useState<Position>({ row: 0, col: 0 }); // Initialize with dummy position
  const [gameStarted, setGameStarted] = useState(false);
  const [time, setTime] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [showFinalExit, setShowFinalExit] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [bestTime, setBestTime] = useState<number | null>(null);

  const MAZE_SIZE = 11;

  // Load best time from localStorage on component mount
  useEffect(() => {
    const savedBestTime = localStorage.getItem("mazeBestTime");
    if (savedBestTime) {
      setBestTime(parseInt(savedBestTime, 10));
    }
  }, []);

  // Update best time when game is won
  useEffect(() => {
    if (gameWon) {
      const currentBestTime = bestTime;
      if (currentBestTime === null || time < currentBestTime) {
        setBestTime(time);
        localStorage.setItem("mazeBestTime", time.toString());
      }
    }
  }, [gameWon, time, bestTime]);

  // Initialize all mazes and set initial player position
  useEffect(() => {
    const mazes = generateAllMazes();
    setAllMazes(mazes);

    // Find the initial player position in the starting maze
    const startingMaze = mazes[0][1].maze;
    for (let row = 0; row < MAZE_SIZE; row++) {
      for (let col = 0; col < MAZE_SIZE; col++) {
        if (startingMaze[row][col] === "player") {
          setPlayerPos({ row, col });
          break;
        }
      }
    }
  }, []);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !gameWon) {
      interval = setInterval(() => {
        setTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameWon]);

  const handleRestart = useCallback(() => {
    const mazes = generateAllMazes();
    setAllMazes(mazes);
    setCurrentMazePos({ row: 0, col: 1 });

    // Find the initial player position in the starting maze
    const startingMaze = mazes[0][1].maze;
    for (let row = 0; row < MAZE_SIZE; row++) {
      for (let col = 0; col < MAZE_SIZE; col++) {
        if (startingMaze[row][col] === "player") {
          setPlayerPos({ row, col });
          break;
        }
      }
    }

    setGameStarted(false);
    setGameWon(false);
    setTime(0);
    setShowInstructions(false);
  }, []);

  const getAdjacentMazePosition = useCallback(
    (currentPos: Position, exitPos: Position): Position => {
      if (exitPos.row === 0)
        return { row: currentPos.row - 1, col: currentPos.col }; // top exit
      if (exitPos.row === MAZE_SIZE - 1)
        return { row: currentPos.row + 1, col: currentPos.col }; // bottom exit
      if (exitPos.col === 0)
        return { row: currentPos.row, col: currentPos.col - 1 }; // left exit
      return { row: currentPos.row, col: currentPos.col + 1 }; // right exit
    },
    []
  );

  const handleMazeTransition = useCallback(
    (newMazePos: Position) => {
      if (
        newMazePos.row < 0 ||
        newMazePos.row >= 5 ||
        newMazePos.col < 0 ||
        newMazePos.col >= 5
      )
        return;

      setAllMazes((prevMazes) => {
        const newMazes = [...prevMazes];

        // Clear player from the previous maze
        const prevMaze = newMazes[currentMazePos.row][currentMazePos.col].maze;
        for (let row = 0; row < MAZE_SIZE; row++) {
          for (let col = 0; col < MAZE_SIZE; col++) {
            if (prevMaze[row][col] === "player") {
              prevMaze[row][col] = "explored";
            }
          }
        }

        newMazes[newMazePos.row][newMazePos.col].explored = true;

        // Create a new maze array to avoid mutating the state directly
        const newMaze = newMazes[newMazePos.row][newMazePos.col].maze.map(
          (row) => [...row]
        );

        // Find a valid position for the player in the new maze
        // Make sure we don't place the player on a checkpoint or exit
        let randomStartPos: Position;
        do {
          randomStartPos = getRandomValidPosition(newMaze);
        } while (
          newMaze[randomStartPos.row][randomStartPos.col] === "checkpoint" ||
          newMaze[randomStartPos.row][randomStartPos.col] === "exit"
        );

        // Clear any existing player position in the new maze
        for (let row = 0; row < MAZE_SIZE; row++) {
          for (let col = 0; col < MAZE_SIZE; col++) {
            if (newMaze[row][col] === "player") {
              newMaze[row][col] = "path";
            }
          }
        }

        // Set the new player position
        newMaze[randomStartPos.row][randomStartPos.col] = "player";
        newMazes[newMazePos.row][newMazePos.col].maze = newMaze;

        // Update player position to match the actual position in the maze
        setPlayerPos(randomStartPos);

        return newMazes;
      });

      setCurrentMazePos(newMazePos);
    },
    [currentMazePos]
  );

  // Common movement logic
  const handleMovement = useCallback(
    (code: string) => {
      if (code === "Space") {
        if (gameWon) {
          handleRestart();
          return;
        }
        if (!gameStarted) {
          setGameStarted(true);
          setShowInstructions(false);
          return;
        }
        return;
      }

      if (!gameStarted || gameWon || isMoving) return;

      const currentMaze = allMazes[currentMazePos.row][currentMazePos.col].maze;
      const newPos = { ...playerPos };
      let moved = false;
      let direction = { row: 0, col: 0 };

      switch (code) {
        case "ArrowUp":
          if (
            newPos.row > 0 &&
            currentMaze[newPos.row - 1][newPos.col] !== "wall"
          ) {
            direction = { row: -1, col: 0 };
            moved = true;
          }
          break;
        case "ArrowDown":
          if (
            newPos.row < MAZE_SIZE - 1 &&
            currentMaze[newPos.row + 1][newPos.col] !== "wall"
          ) {
            direction = { row: 1, col: 0 };
            moved = true;
          }
          break;
        case "ArrowLeft":
          if (
            newPos.col > 0 &&
            currentMaze[newPos.row][newPos.col - 1] !== "wall"
          ) {
            direction = { row: 0, col: -1 };
            moved = true;
          }
          break;
        case "ArrowRight":
          if (
            newPos.col < MAZE_SIZE - 1 &&
            currentMaze[newPos.row][newPos.col + 1] !== "wall"
          ) {
            direction = { row: 0, col: 1 };
            moved = true;
          }
          break;
      }

      if (moved) {
        setIsMoving(true);

        newPos.row = playerPos.row + direction.row;
        newPos.col = playerPos.col + direction.col;

        const newMazes = [...allMazes];
        const currentMaze = newMazes[currentMazePos.row][currentMazePos.col];

        currentMaze.maze[playerPos.row][playerPos.col] = "explored";

        if (currentMaze.maze[newPos.row][newPos.col] === "exit") {
          setGameWon(true);
          currentMaze.maze[newPos.row][newPos.col] = "player";
        } else if (currentMaze.maze[newPos.row][newPos.col] === "checkpoint") {
          const newMazePos = getAdjacentMazePosition(currentMazePos, newPos);
          handleMazeTransition(newMazePos);
        } else {
          currentMaze.maze[newPos.row][newPos.col] = "player";
        }

        setAllMazes(newMazes);
        setPlayerPos(newPos);

        setTimeout(() => {
          setIsMoving(false);
        }, 50);
      }
    },
    [
      playerPos,
      allMazes,
      currentMazePos,
      gameStarted,
      gameWon,
      isMoving,
      handleRestart,
      handleMazeTransition,
    ]
  );

  // Handle keyboard controls
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          event.code
        )
      ) {
        event.preventDefault();
      }

      handleMovement(event.code);
    },
    [handleMovement]
  );

  // Separate handler for on-screen buttons
  const handleButtonPress = useCallback(
    (code: string) => {
      handleMovement(code);
    },
    [handleMovement]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyPress, { capture: true });
    };
  }, [handleKeyPress]);

  const getCellColor = (cell: CellType, isDark: boolean) => {
    switch (cell) {
      case "wall":
        return isDark ? "bg-gray-700" : "bg-gray-800";
      case "path":
        return isDark ? "bg-gray-500" : "bg-gray-200";
      case "player":
        return isDark ? "bg-blue-400" : "bg-blue-500";
      case "exit":
        return isDark ? "bg-green-400" : "bg-green-500";
      case "checkpoint":
        return isDark ? "bg-yellow-300" : "bg-yellow-400";
      case "explored":
        return showTrails
          ? isDark
            ? "bg-blue-300"
            : "bg-blue-200"
          : isDark
          ? "bg-gray-500"
          : "bg-gray-200";
      case "unexplored":
        return isDark ? "bg-gray-600" : "bg-gray-300";
      default:
        return isDark ? "bg-gray-600" : "bg-gray-300";
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900"
          : "bg-gradient-to-br from-white via-green-50 to-green-100"
      } flex flex-col items-center justify-center p-4 transition-colors duration-200`}
    >
      {/* Main Game Container */}
      <div
        className={`flex flex-col gap-8 w-full max-w-3xl mx-auto items-center justify-center ${
          !gameStarted || showInstructions ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Buttons Row */}
        <div className="flex justify-between w-full">
          <button
            onClick={() => setShowInstructions(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 hover:from-blue-600 hover:to-indigo-600 transition-colors cursor-pointer"
          >
            <FaInfoCircle className="h-5 w-5" />
            <span>Menu</span>
          </button>
          <button
            onClick={toggleTheme}
            className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center ${
              isDark
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-yellow-200 hover:from-indigo-700 hover:to-purple-700"
                : "bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600"
            } transition-colors cursor-pointer`}
          >
            {isDark ? (
              <FiSun className="h-5 w-5" />
            ) : (
              <FiMoon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Game Elements Row */}
        <div className="flex flex-col md:flex-row gap-8 items-stretch flex-1 w-full">
          {/* Minimap */}
          {allMazes.length > 0 && (
            <div
              className={`bg-gradient-to-br ${
                isDark
                  ? "from-gray-900 to-indigo-900 border-indigo-700"
                  : "from-white to-green-50 border-green-100"
              } p-2 sm:p-4 md:p-6 rounded-lg shadow-lg w-full md:w-auto flex flex-col items-center border transition-colors duration-200 max-h-fit`}
            >
              <div className="flex justify-between items-center w-full mb-4">
                <h2
                  className={`text-lg sm:text-xl font-bold mr-4 ${
                    isDark ? "text-gray-100" : "text-gray-800"
                  }`}
                >
                  Minimap
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTrails(!showTrails)}
                    className={`cursor-pointer px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                      showTrails
                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    {showTrails ? "Hide Trails" : "Show Trails"}
                  </button>
                  <button
                    onClick={() => setShowFinalExit(!showFinalExit)}
                    className={`cursor-pointer px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                      showFinalExit
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                    }`}
                  >
                    {showFinalExit ? "Hide Exit" : "Show Exit"}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1 sm:gap-2 w-fit">
                {allMazes.map((row, rowIndex) =>
                  row.map((maze, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12 rounded-lg border-2 transition-colors ${
                        currentMazePos.row === rowIndex &&
                        currentMazePos.col === colIndex &&
                        showTrails
                          ? isDark
                            ? "border-blue-400 bg-blue-900"
                            : "border-blue-500 bg-blue-100"
                          : maze.explored && showTrails
                          ? isDark
                            ? "border-gray-500 bg-gray-700"
                            : "border-gray-400 bg-gray-100"
                          : isDark
                          ? "border-gray-600 bg-gray-800"
                          : "border-gray-200 bg-gray-50"
                      } ${
                        showFinalExit && maze.hasFinalExit
                          ? isDark
                            ? "bg-green-900 border-green-400"
                            : "bg-green-100 border-green-500"
                          : ""
                      }`}
                    />
                  ))
                )}
              </div>
              <div
                className={`mt-2 sm:mt-4 text-xs sm:text-sm ${
                  isDark ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {showTrails && (
                  <>
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                      <div
                        className={`w-2 h-2 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded ${
                          isDark
                            ? "bg-blue-900 border-2 border-blue-400"
                            : "bg-blue-100 border-2 border-blue-500"
                        }`}
                      ></div>
                      <span>Current Maze</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                      <div
                        className={`w-2 h-2 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded ${
                          isDark
                            ? "bg-gray-700 border-2 border-gray-500"
                            : "bg-gray-100 border-2 border-gray-400"
                        }`}
                      ></div>
                      <span>Explored</span>
                    </div>
                  </>
                )}
                {showFinalExit && (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div
                      className={`w-2 h-2 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded ${
                        isDark
                          ? "bg-green-900 border-2 border-green-400"
                          : "bg-green-100 border-2 border-green-500"
                      }`}
                    ></div>
                    <span>Final Exit</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Maze */}
          <div
            className={`bg-gradient-to-br ${
              isDark
                ? "from-gray-900 to-indigo-900 border-indigo-700"
                : "from-white to-green-50 border-green-100"
            } p-2 sm:p-4 md:p-6 rounded-lg shadow-lg relative flex-shrink-0 flex flex-col items-center border transition-colors duration-200 max-h-fit flex-1`}
          >
            <div className="mb-2 sm:mb-4 text-center w-full">
              <h1
                className={`text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 ${
                  isDark ? "text-gray-100" : "text-gray-800"
                }`}
              >
                Maze Runner
              </h1>
              <div
                className={`text-base sm:text-lg md:text-xl font-mono p-1 sm:p-2 rounded inline-block border ${
                  isDark
                    ? "bg-gradient-to-r from-gray-800 to-indigo-900 border-indigo-700 text-gray-100"
                    : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 text-gray-800"
                }`}
              >
                Time: {formatTime(time)}
              </div>
            </div>

            {allMazes.length > 0 &&
              allMazes[currentMazePos.row]?.[currentMazePos.col]?.maze && (
                <div
                  className="grid gap-0.5 sm:gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${MAZE_SIZE}, minmax(0, 1fr))`,
                    width: "min(300px, 100vw - 2rem)",
                    height: "min(300px, 100vw - 2rem)",
                  }}
                >
                  {allMazes[currentMazePos.row][currentMazePos.col].maze.map(
                    (row, rowIndex) =>
                      row.map((cell, colIndex) => (
                        <motion.div
                          key={`${rowIndex}-${colIndex}`}
                          className={`${getCellColor(
                            cell,
                            isDark
                          )} rounded-sm transition-colors duration-200`}
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ duration: 0.2 }}
                        />
                      ))
                  )}
                </div>
              )}

            {/* Mobile Controls */}
            <div className="md:hidden mt-6 grid grid-cols-3 gap-4 max-w-[300px] mx-auto">
              <div></div>
              <button
                onClick={() => handleButtonPress("ArrowUp")}
                className="bg-blue-500 text-white p-4 rounded-lg shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
              >
                <FaArrowUp className="h-6 w-6" />
              </button>
              <div></div>
              <button
                onClick={() => handleButtonPress("ArrowLeft")}
                className="bg-blue-500 text-white p-4 rounded-lg shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
              >
                <FaArrowLeft className="h-6 w-6" />
              </button>
              <div></div>
              <button
                onClick={() => handleButtonPress("ArrowRight")}
                className="bg-blue-500 text-white p-4 rounded-lg shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
              >
                <FaArrowRight className="h-6 w-6" />
              </button>
              <div></div>
              <button
                onClick={() => handleButtonPress("ArrowDown")}
                className="bg-blue-500 text-white p-4 rounded-lg shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
              >
                <FaArrowDown className="h-6 w-6" />
              </button>
              <div></div>
            </div>

            {/* Game Won Modal */}
            {gameWon && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`absolute inset-0 ${
                  isDark
                    ? "bg-gradient-to-br from-gray-900 to-indigo-900 border-indigo-700"
                    : "bg-gradient-to-br from-white to-green-50 border-green-100"
                } bg-opacity-95 flex flex-col items-center justify-center rounded-lg border`}
              >
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center p-4"
                >
                  <h2
                    className={`text-3xl md:text-4xl font-bold ${
                      isDark ? "text-green-400" : "text-green-600"
                    } mb-4`}
                  >
                    🎉 Congratulations!
                  </h2>
                  <p
                    className={`text-lg md:text-xl ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    } mb-2`}
                  >
                    You found the final exit!
                  </p>
                  <div className="flex flex-col space-y-4 mb-6">
                    <p
                      className={`text-xl md:text-2xl font-mono p-2 rounded inline-block border ${
                        isDark
                          ? "bg-gradient-to-r from-gray-800 to-indigo-900 border-indigo-700 text-blue-300"
                          : "bg-gradient-to-r from-blue-50 to-green-50 border-blue-100 text-blue-600"
                      }`}
                    >
                      Time: {formatTime(time)}
                    </p>
                    {bestTime !== null && (
                      <p
                        className={`text-lg md:text-xl font-mono p-2 rounded inline-block border ${
                          isDark
                            ? "bg-gradient-to-r from-gray-800 to-indigo-900 border-indigo-700 text-yellow-300"
                            : "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-100 text-yellow-600"
                        }`}
                      >
                        Best Time: {formatTime(bestTime)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-4">
                    <button
                      onClick={handleRestart}
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:from-blue-600 hover:to-indigo-600 transition-colors cursor-pointer shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      Play Again
                    </button>
                    <p
                      className={`text-base font-bold ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      } mt-2`}
                    >
                      Press space to start a new game
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {!gameStarted && !gameWon && !showInstructions && (
              <div
                className={`mt-4 text-center ${
                  isDark ? "text-gray-300" : "text-gray-600"
                }`}
              >
                Press space or click Start to begin
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed inset-0 ${
            isDark
              ? "bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900"
              : "bg-gradient-to-br from-white to-purple-50"
          } bg-opacity-95 z-50 flex items-center justify-center p-4 md:absolute md:top-4 md:left-4 md:inset-auto md:max-w-md md:rounded-lg md:shadow-lg border ${
            isDark ? "border-indigo-700" : "border-purple-100"
          }`}
        >
          <div className="max-w-md w-full">
            <h2
              className={`text-2xl font-bold mb-4 ${
                isDark ? "text-gray-100" : "text-gray-800"
              }`}
            >
              How to Play
            </h2>
            <ul
              className={`list-disc list-inside space-y-2 mb-6 ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              <li>
                Use arrow keys or on-screen buttons to move the player (blue
                square)
              </li>
              <li>Find your way through 25 connected mazes</li>
              <li>Yellow checkpoints lead to adjacent mazes</li>
              <li>Find the final green exit to win</li>
              <li>Press space or click Start to begin the game and timer</li>
              <li>Try to complete all mazes as fast as possible!</li>
            </ul>
            <div className="flex flex-col md:flex-row gap-4">
              <button
                onClick={() => {
                  setShowInstructions(false);
                  if (!gameStarted) {
                    setGameStarted(true);
                  }
                }}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:from-blue-600 hover:to-indigo-600 transition-colors cursor-pointer"
              >
                {gameStarted ? "Got it!" : "Start Game"}
              </button>
              {gameStarted && (
                <button
                  onClick={() => setShowInstructions(false)}
                  className={`px-6 py-3 rounded-lg text-lg font-semibold transition-colors cursor-pointer ${
                    isDark
                      ? "bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 hover:from-gray-600 hover:to-gray-700"
                      : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 hover:from-gray-200 hover:to-gray-300"
                  }`}
                >
                  Back to Game
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

const MazeGame = () => {
  return (
    <ThemeProvider>
      <MainContent />
    </ThemeProvider>
  );
};

export default MazeGame;
