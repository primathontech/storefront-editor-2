import { TrashRedIcon } from "./icons/TrashIcon";

interface RemoveSectionButtonProps {
  onClick?: () => void;
}

export const RemoveSectionButton = ({ onClick }: RemoveSectionButtonProps) => (
  <div className="mt-auto border-t-[0.5px] border-editor-border">
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-4 text-sm font-medium text-[#FF5050] hover:bg-[#FF5050]/5 transition-colors w-full"
    >
      <TrashRedIcon className="shrink-0" />
      <span>Remove section</span>
    </button>
  </div>
);
