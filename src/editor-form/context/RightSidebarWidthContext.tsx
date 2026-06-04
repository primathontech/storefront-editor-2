import { createContext, useContext, useState, type ReactNode } from "react";

interface Value {
  width: number;
  setWidth: (w: number) => void;
}

const Ctx = createContext<Value>({
  width: 360,
  setWidth: () => {},
});

export const RightSidebarWidthProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [width, setWidth] = useState(360);
  return <Ctx.Provider value={{ width, setWidth }}>{children}</Ctx.Provider>;
};

export const useRightSidebarWidth = () => useContext(Ctx);
