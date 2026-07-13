\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{resume}[2015/05/25 An elegant Résumé class]
\LoadClass[10pt]{article}

% disable indent globally
\setlength{\parindent}{0pt}
% some general improvements, defines the XeTeX logo
\RequirePackage{xltxtra}
% use xifthen
\RequirePackage{xifthen}
% use fontawesome
\RequirePackage{fontawesome}
% use xcolor for customizing color
\RequirePackage[usenames,dvipsnames]{xcolor}

% loading fonts
\RequirePackage{fontspec}
% Main document font — use Windows/Mac system fonts
\IfFontExistsTF{Times New Roman}{%
  \setmainfont{Times New Roman}
}{%
  \IfFontExistsTF{Latin Modern Roman}{%
    \setmainfont{Latin Modern Roman}
  }{%
    \setmainfont{texgyretermes}
  }%
}

% \RequirePackage[
% 	a4paper,
% 	left=0.7in,
% 	right=0.7in,
% 	top=0.50in,
% 	bottom=0.5in,
% 	nohead
% ]{geometry}

\RequirePackage[
	a4paper,
	left=0.4in,
	right=0.4in,
	top=0.4in,
	bottom=0.3in,
	nohead
]{geometry}

\RequirePackage{titlesec}
\RequirePackage{enumitem}
\setlist{noitemsep} % removes spacing from items but leaves space around the whole list
%\setlist{nosep} % removes all vertical spacing within and around the list
\setlist[itemize]{topsep=0.25em, leftmargin=1.5pc}
\setlist[enumerate]{topsep=0.25em, leftmargin=1.5pc}
\RequirePackage[super]{nth}

% --- Color Palette ---
\definecolor{accent}{HTML}{2B579A}     % 沉稳蓝（section 标题 & 横线）
\definecolor{darktext}{HTML}{1A1A1A}   % 正文深灰
\definecolor{lightrule}{HTML}{CCCCCC}  % 浅灰分隔线
\definecolor{subtle}{HTML}{555555}     % 次要文字

\newcommand{\ResumeLabel}[1]{{\sffamily\scshape\textcolor{accent}{#1}}}
\newcommand{\ProjectName}[1]{{\sectionheiti\bfseries\textcolor{black}{#1}}}

% --- Section styling ---
\titleformat{\section}
  {\Large\bfseries\sectionheiti\raggedright\color{accent}}
  {}{0em}
  {}
  [\vspace{-1.5ex}\textcolor{accent}{\titlerule}]
\titlespacing*{\section}{0cm}{1.2ex}{0.8ex}

\titleformat{\subsection}
  {\large\raggedright}
  {}{0em}
  {}
\titlespacing*{\subsection}{0cm}{*1}{*0.5}

\newcommand{\datedsection}[2]{%
  \section[#1]{#1 \hfill #2}%
}
\newcommand{\datedsubsection}[2]{%
  \subsection[#1]{#1 \hfill #2}%
}
\newcommand{\datedline}[2]{%
  {\par #1 \hfill #2 \par}%
}

\newcommand{\name}[1]{
  \centerline{\Huge\scshape{#1}} 
  \vspace{1.2ex}
}
\newcommand{\contactInfo}[2]{
  \centerline{\sffamily\large{\ 手机：{#1} \textperiodcentered\ \ 邮箱：{#2}}} 
  \vspace{1.2ex}
}
\newcommand{\otherInfo}[4]{
  \centerline{\sffamily\large{\ {#1}}
    \ifthenelse{\isempty{#2}}%
      { } % if {#2} is empty
      {\textperiodcentered\ \ {#2} } % homepage, no space before \text...
    \ifthenelse{\isempty{#3}}%
      { } % if {#3} is empty
      {\textperiodcentered\ \ {#3} } % homepage, no space before \text...
    \ifthenelse{\isempty{#4}}%
      { } % if {#3} is empty
      {\textperiodcentered\ \ {#4} }
  }
  \vspace{0.7ex}
}

\newcommand{\yourphoto}[1]{
  \hfill
  \makebox[0pt][r]{\raisebox{-1cm}[0pt][0pt]{\includegraphics[width=#1\paperwidth]{images/you.jpg}}}
}

\newlength{\photowidth}
\newcommand{\yourphotopos}[2]{
  \hfill
  \setlength{\photowidth}{#1\paperwidth}
  \makebox[0pt][r]{\raisebox{#2}[0pt][0pt]{\includegraphics[width=\photowidth]{images/you.jpg}}}
}

\newcommand{\role}[2]{
  {\par \textit{#1} ~ #2 \par}
  \vspace{0.5ex}
}

% add
\newcommand{\sepspace}{\vspace*{0.5em}}		        % Vertical space macro

\newcommand{\MyName}[1]{
    \noindent
    \Huge \usefont{OT1}{phv}{m}{n} \textcolor{accent}{#1} \hfill        % Name
    \par \normalsize \normalfont
    \vspace{1.0ex}
}

\newcommand{\InfoField}[2]{%
  {\textcolor{accent}{\bfseries #1}}\,#2%
}

\newcommand{\BasicInfoBlock}[5]{%
  \noindent
  \begin{tabular*}{\textwidth}{@{\extracolsep{\fill}}p{0.48\textwidth}p{0.48\textwidth}@{}}
    \InfoField{籍贯：}{#1} & \InfoField{邮箱：}{#2} \\
    \InfoField{电话：}{#3} & \InfoField{政治面貌：}{#4} \\
    \multicolumn{2}{@{}l@{}}{\InfoField{作品集：}{#5}} \\
  \end{tabular*}
  \vspace{0.8ex}
}

\newcommand{\SimpleEntry}[1]{
	\noindent\hangindent=0.5cm\hangafter=0          % Indentation
	#1 \par                                         % Entry 
}

\newcommand{\Content}[3]{  % 3个参数
    \begin{itemize}[parsep=0.5ex]
    % \songti 命令指定内容为宋体，覆盖默认或斜体的字体样式
    \item \songti #1
    \item \songti #2
    \def\@tmp{#3}%
    \ifx\@tmp\@empty\else
    \item \songti #3
    \fi
    \end{itemize}
    \normalsize \par
}

\newcommand{\Contenttwo}[2]{  % 2个参数
    \begin{itemize}[parsep=0.5ex]
    \item \songti #1
    \item \songti #2
    \end{itemize}
    \normalsize \par
}

% --- Award section helpers ---
\newcommand{\AwardGroup}[1]{%  分组小标题
    \vspace{0.4ex}
    {\sffamily\footnotesize\textcolor{accent}{\textbf{#1}}}
    \vspace{0.1ex}
}

\newcommand{\AwardItem}[2]{%  #1=奖项名称, #2=级别/层级
    \item \textbf{\songti #1} \hfill {\footnotesize\textcolor{subtle}{\songti #2}}
}
