export type UnknownMap = Record<string, unknown>;

export interface Option {
  id: string;
  label: string;
  markdown?: string;
  output?: Output | null;
  followups?: string[];
  input?: Input;
  recommendation?: Recommendation;
}
export interface Input {
  prefix?: string;
  placeholder?: string;
  history?: { enabled?: boolean };
  user_template?: { enabled?: boolean };
}
export interface Output {
  section: string;
  kind: string;
  markdown?: string;
  template?: string;
  lead?: string;
  language?: string;
}
export interface Recommendation {
  files_any?: string[];
  globs_any?: string[];
  answer_equals?: { question: string; option: string };
  score: number;
}
export interface Question {
  label: string;
  type:
    | "single_select"
    | "multi_select"
    | "text"
    | "list"
    | "pair_list"
    | "group";
  order: number;
  skippable?: boolean;
  output?: Output | null;
  options?: Option[];
  followups?: string[];
  children?: string[];
  input?: Input;
  item?: Input;
  fields?: { id: string; label: string; kind: string }[];
  custom_input?: Input & { label?: string; repeatable?: boolean };
  allow_custom?: boolean;
}
export interface Catalog {
  wizard: {
    title?: string;
    output_file: string;
    answer_record_file: string;
    default_skippable: boolean;
    history_limit: number;
    template_promotion_usage_threshold: number;
    top_level_questions: string[];
  };
  sections: Record<string, { title: string; order: number }>;
  questions: Record<string, Question>;
}
export type Answer = {
  questionId: string;
  answerId: string;
  value?: string;
  values?: string[];
  pairs?: Record<string, string>[];
};
export type Answers = Map<string, Answer>;
