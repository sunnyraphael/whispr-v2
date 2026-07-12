import { buildStyles } from "../../styles/theme";

export default function StyleTag({ theme }) {
  return <style dangerouslySetInnerHTML={{ __html: buildStyles(theme) }} />;
}
